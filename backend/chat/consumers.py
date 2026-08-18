import json
from asgiref.sync import async_to_sync
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError
from .models import Message, Room, MessageReaction

connected_users = {}


def disconnect_user(matricule, message='Ton compte a été suspendu.'):
    if matricule in connected_users:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.send)(connected_users[matricule], {
            'type': 'force_disconnect', 'message': message,
        })


class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.username = None
        self.display_name = None
        self.current_room = 'general'
        self.room_group_name = 'chat_general'
        self.joined_groups = set()

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        if self.username and connected_users.get(self.username) == self.channel_name:
            del connected_users[self.username]
            await self.broadcast_user_list()

        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        for group_id in self.joined_groups:
            await self.channel_layer.group_discard(f'group_{group_id}', self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type')

        if msg_type == 'join':
            user = await self.authenticate(data.get('token', ''))
            if user is None:
                await self.send(text_data=json.dumps({
                    'type': 'join_error',
                    'message': 'Session invalide, reconnecte-toi.',
                }))
                await self.close()
                return

            if user.matricule in connected_users:
                await self.send(text_data=json.dumps({
                    'type': 'join_error',
                    'message': 'Ce compte est déjà connecté ailleurs.',
                }))
                await self.close()
                return

            self.username = user.matricule
            self.display_name = user.first_name or user.matricule
            connected_users[self.username] = self.channel_name

            history = await self.get_history('general')
            rooms = await self.get_rooms()

            await self.send(text_data=json.dumps({
                'type': 'init',
                'history': history,
                'rooms': rooms,
            }))

            await self.broadcast_user_list()

        elif msg_type == 'join_room':
            old_group = f'chat_{self.current_room}'
            await self.channel_layer.group_discard(old_group, self.channel_name)

            self.current_room = data['room']
            new_group = f'chat_{self.current_room}'
            await self.channel_layer.group_add(new_group, self.channel_name)

            history = await self.get_history(self.current_room)
            await self.send(text_data=json.dumps({
                'type': 'history',
                'room': self.current_room,
                'messages': history,
            }))

        elif msg_type == 'message':
            content = data['content']
            room = data.get('room', self.current_room)
            await self.save_message(self.username, content, room)

            await self.channel_layer.group_send(
                f'chat_{room}',
                {
                    'type': 'chat_message',
                    'username': self.username,
                    'display_name': self.display_name,
                    'content': content,
                    'room': room,
                }
            )

        elif msg_type == 'private':
            target = data['to']
            content = data.get('content', '')
            file_url = data.get('file_url', '')
            file_name = data.get('file_name', '')

            conversation_status = await self.evaluate_message_permission(self.username, target)
            if conversation_status is None:
                await self.send(text_data=json.dumps({
                    'type': 'private_error',
                    'to': target,
                    'message': 'Cette personne ne peut pas être contactée (amitié ou confidentialité).',
                }))
                return

            room_key = f'pm_{"_".join(sorted([self.username, target]))}'

            saved = await self.save_message(self.username, content, room_key, file_url, file_name)
            await self.notify_message(self.username, target, content or file_name)

            await self.send(text_data=json.dumps({
                'type': 'private',
                'id': saved['id'],
                'from': self.username,
                'from_display_name': self.display_name,
                'to': target,
                'content': content,
                'file_url': file_url,
                'file_name': file_name,
                'conversation_status': conversation_status,
                'timestamp': saved['timestamp'],
            }))

            if target in connected_users:
                await self.channel_layer.send(
                    connected_users[target],
                    {
                        'type': 'private_message',
                        'id': saved['id'],
                        'from': self.username,
                        'from_display_name': self.display_name,
                        'to': target,
                        'content': content,
                        'file_url': file_url,
                        'file_name': file_name,
                        'conversation_status': conversation_status,
                        'timestamp': saved['timestamp'],
                    }
                )

        elif msg_type == 'join_group':
            group_id = data['group_id']
            if not await self.is_group_member(group_id):
                await self.send(text_data=json.dumps({
                    'type': 'group_error',
                    'group_id': group_id,
                    'message': "Tu n'es pas membre de ce groupe.",
                }))
                return

            group_channel = f'group_{group_id}'
            await self.channel_layer.group_add(group_channel, self.channel_name)
            self.joined_groups.add(group_id)

            history = await self.get_history(group_channel)
            await self.send(text_data=json.dumps({
                'type': 'group_history',
                'group_id': group_id,
                'messages': history,
            }))

        elif msg_type == 'group_message':
            group_id = data['group_id']
            content = data.get('content', '')
            file_url = data.get('file_url', '')
            file_name = data.get('file_name', '')
            if not await self.is_group_member(group_id):
                await self.send(text_data=json.dumps({
                    'type': 'group_error',
                    'group_id': group_id,
                    'message': "Tu n'es pas membre de ce groupe.",
                }))
                return

            room = f'group_{group_id}'
            saved = await self.save_message(self.username, content, room, file_url, file_name)

            await self.channel_layer.group_send(
                room,
                {
                    'type': 'group_chat_message',
                    'group_id': group_id,
                    'id': saved['id'],
                    'username': self.username,
                    'display_name': self.display_name,
                    'content': content,
                    'file_url': file_url,
                    'file_name': file_name,
                    'timestamp': saved['timestamp'],
                }
            )

        elif msg_type == 'typing':
            target = data['to']
            if target in connected_users and await self.can_send_typing(self.username, target):
                await self.channel_layer.send(
                    connected_users[target],
                    {'type': 'typing_indicator', 'from': self.username}
                )

        elif msg_type == 'react_message':
            message_id = data.get('id')
            emoji = data.get('emoji')
            if not message_id or not emoji:
                return
            reactions = await self.set_reaction(message_id, self.username, emoji)
            if reactions is None:
                return
            target = data.get('to')
            group_id = data.get('group_id')
            payload = {'type': 'message_reaction', 'id': message_id, 'reactions': reactions, 'group_id': group_id}
            if group_id is not None:
                await self.channel_layer.group_send(f'group_{group_id}', payload)
            elif target:
                await self.send(text_data=json.dumps(payload))
                if target in connected_users:
                    await self.channel_layer.send(connected_users[target], payload)

        elif msg_type == 'edit_message':
            message_id = data.get('id')
            new_content = (data.get('content') or '').strip()
            if not message_id or not new_content:
                return
            ok = await self.edit_message(message_id, self.username, new_content)
            if not ok:
                return
            target = data.get('to')
            group_id = data.get('group_id')
            payload = {'type': 'message_edited', 'id': message_id, 'content': new_content, 'group_id': group_id}
            if group_id is not None:
                await self.channel_layer.group_send(f'group_{group_id}', payload)
            elif target:
                await self.send(text_data=json.dumps(payload))
                if target in connected_users:
                    await self.channel_layer.send(connected_users[target], payload)

        elif msg_type == 'delete_message':
            message_id = data.get('id')
            if not message_id:
                return
            ok = await self.delete_message(message_id, self.username)
            if not ok:
                return
            target = data.get('to')
            group_id = data.get('group_id')
            payload = {'type': 'message_deleted', 'id': message_id, 'group_id': group_id}
            if group_id is not None:
                await self.channel_layer.group_send(f'group_{group_id}', payload)
            elif target:
                await self.send(text_data=json.dumps(payload))
                if target in connected_users:
                    await self.channel_layer.send(connected_users[target], payload)

        elif msg_type == 'create_room':
            name = data['name']
            description = data.get('description', '')
            await self.create_room(name, description)
            rooms = await self.get_rooms()

            payload = {'type': 'rooms_update', 'rooms': rooms}
            for channel_name in list(connected_users.values()):
                await self.channel_layer.send(channel_name, payload)

    async def broadcast_user_list(self):
        payload = {
            'type': 'user_list',
            'users': list(connected_users.keys()),
            'count': len(connected_users),
        }
        for channel_name in list(connected_users.values()):
            await self.channel_layer.send(channel_name, payload)

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'username': event['username'],
            'display_name': event.get('display_name'),
            'content': event['content'],
            'room': event['room'],
        }))

    async def private_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'private',
            'id': event.get('id'),
            'from': event['from'],
            'from_display_name': event.get('from_display_name'),
            'to': event['to'],
            'content': event['content'],
            'file_url': event.get('file_url', ''),
            'file_name': event.get('file_name', ''),
            'conversation_status': event.get('conversation_status'),
            'timestamp': event.get('timestamp'),
        }))

    async def message_reaction(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_reaction',
            'id': event['id'],
            'reactions': event['reactions'],
            'group_id': event.get('group_id'),
        }))

    async def message_edited(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_edited',
            'id': event['id'],
            'content': event['content'],
            'group_id': event.get('group_id'),
        }))

    async def message_deleted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_deleted',
            'id': event['id'],
            'group_id': event.get('group_id'),
        }))

    async def user_list(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_list',
            'users': event['users'],
            'count': event['count'],
        }))

    async def rooms_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'rooms_update',
            'rooms': event['rooms'],
        }))

    async def typing_indicator(self, event):
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'from': event['from'],
        }))

    async def group_chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'group_message',
            'group_id': event['group_id'],
            'id': event.get('id'),
            'username': event['username'],
            'display_name': event.get('display_name'),
            'content': event['content'],
            'file_url': event.get('file_url', ''),
            'file_name': event.get('file_name', ''),
            'timestamp': event.get('timestamp'),
        }))

    async def poll_created(self, event):
        await self.send(text_data=json.dumps({
            'type': 'poll_created',
            'group_id': event['group_id'],
            'poll': event['poll'],
        }))

    async def poll_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'poll_updated',
            'group_id': event['group_id'],
            'poll': event['poll'],
        }))

    async def messages_read(self, event):
        await self.send(text_data=json.dumps({
            'type': 'messages_read',
            'room': event['room'],
            'by': event['by'],
        }))

    async def force_disconnect(self, event):
        await self.send(text_data=json.dumps({
            'type': 'force_disconnect',
            'message': event.get('message', 'Ton compte a été suspendu.'),
        }))
        await self.close()

    @database_sync_to_async
    def authenticate(self, token):
        from accounts.models import User
        try:
            access = AccessToken(token)
            return User.objects.get(id=access['user_id'], is_active=True)
        except (TokenError, KeyError, User.DoesNotExist):
            return None

    @database_sync_to_async
    def can_send_typing(self, from_matricule, to_matricule):
        from accounts.models import User
        from social.views import are_blocked, are_friends
        try:
            a = User.objects.get(matricule=from_matricule)
            b = User.objects.get(matricule=to_matricule)
        except User.DoesNotExist:
            return False
        if are_blocked(a, b):
            return False
        if are_friends(a, b):
            return True
        return b.who_can_message == b.VISIBILITY_EVERYONE

    @database_sync_to_async
    def evaluate_message_permission(self, from_matricule, to_matricule):
        from accounts.models import User
        from social.views import are_blocked, are_friends
        from .models import Conversation
        try:
            a = User.objects.get(matricule=from_matricule)
            b = User.objects.get(matricule=to_matricule)
        except User.DoesNotExist:
            return None

        if are_blocked(a, b):
            return None

        if are_friends(a, b):
            return Conversation.STATUS_ACCEPTED

        if b.who_can_message != b.VISIBILITY_EVERYONE:
            return None

        u1, u2 = Conversation.between(a, b)
        convo, _ = Conversation.objects.get_or_create(
            user_a=u1, user_b=u2,
            defaults={'initiated_by': a, 'status': Conversation.STATUS_PENDING},
        )
        return convo.status

    @database_sync_to_async
    def set_reaction(self, message_id, username, emoji):
        from django.db.models import Count
        if not Message.objects.filter(id=message_id).exists():
            return None
        existing = MessageReaction.objects.filter(message_id=message_id, username=username).first()
        if existing and existing.emoji == emoji:
            existing.delete()
        else:
            MessageReaction.objects.update_or_create(
                message_id=message_id, username=username, defaults={'emoji': emoji},
            )
        rows = MessageReaction.objects.filter(message_id=message_id).values('emoji').annotate(count=Count('id'))
        return {row['emoji']: row['count'] for row in rows}

    @database_sync_to_async
    def edit_message(self, message_id, username, new_content):
        updated = Message.objects.filter(id=message_id, username=username, deleted=False).update(
            content=new_content, edited=True,
        )
        return bool(updated)

    @database_sync_to_async
    def delete_message(self, message_id, username):
        updated = Message.objects.filter(id=message_id, username=username).update(
            content='', file_url='', file_name='', deleted=True,
        )
        return bool(updated)

    @database_sync_to_async
    def notify_message(self, from_matricule, to_matricule, content):
        from accounts.models import User
        from social.models import Notification
        from social.push import send_push_to_user
        try:
            sender = User.objects.get(matricule=from_matricule)
            target = User.objects.get(matricule=to_matricule)
        except User.DoesNotExist:
            return
        preview = content if len(content) <= 60 else content[:57] + '...'
        message = f'{sender.first_name}: {preview}'
        Notification.objects.create(
            user=target, type=Notification.TYPE_MESSAGE,
            message=message, related_id=sender.id,
        )
        send_push_to_user(target, Notification.TYPE_MESSAGE, message, url=f'/messages/{sender.matricule}')

    @database_sync_to_async
    def is_group_member(self, group_id):
        from accounts.models import User
        from social.models import GroupMembership
        if not self.username:
            return False
        try:
            user = User.objects.get(matricule=self.username)
        except User.DoesNotExist:
            return False
        return GroupMembership.objects.filter(group_id=group_id, user=user).exists()

    @database_sync_to_async
    def get_history(self, room):
        from accounts.models import User
        from django.db.models import Count
        messages = list(Message.objects.filter(room=room).order_by('timestamp')[:50])
        matricules = {m.username for m in messages}
        names = dict(User.objects.filter(matricule__in=matricules).values_list('matricule', 'first_name'))

        message_ids = [m.id for m in messages]
        reactions_by_message = {}
        for row in MessageReaction.objects.filter(message_id__in=message_ids).values('message_id', 'emoji').annotate(count=Count('id')):
            reactions_by_message.setdefault(row['message_id'], {})[row['emoji']] = row['count']
        my_reactions = dict(
            MessageReaction.objects.filter(message_id__in=message_ids, username=self.username).values_list('message_id', 'emoji')
        )

        return [
            {
                'id': m.id,
                'username': m.username,
                'display_name': names.get(m.username, m.username),
                'content': m.content,
                'file_url': m.file_url,
                'file_name': m.file_name,
                'timestamp': m.timestamp.strftime('%H:%M'),
                'edited': m.edited,
                'deleted': m.deleted,
                'reactions': reactions_by_message.get(m.id, {}),
                'my_reaction': my_reactions.get(m.id),
            }
            for m in messages
        ]

    @database_sync_to_async
    def save_message(self, username, content, room, file_url='', file_name=''):
        message = Message.objects.create(username=username, content=content, room=room, file_url=file_url, file_name=file_name)
        return {'id': message.id, 'timestamp': message.timestamp.strftime('%H:%M')}

    @database_sync_to_async
    def get_rooms(self):
        rooms = Room.objects.all().values('name', 'description')
        result = [{'name': 'general', 'description': 'Salon général'}]
        result += list(rooms)
        return result

    @database_sync_to_async
    def create_room(self, name, description):
        Room.objects.get_or_create(name=name, defaults={'description': description})
