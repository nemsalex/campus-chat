from django.conf import settings
from django.core.files.storage import default_storage
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q, Count, Max
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework import permissions, status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from accounts.permissions import IsCreator
from .models import Message, Room, Conversation, MessageReaction
from .consumers import connected_users
import json
import uuid


def broadcast_rooms_update():
    rooms = [{'name': 'general', 'description': 'Salon général'}]
    rooms += list(Room.objects.all().values('name', 'description'))
    channel_layer = get_channel_layer()
    payload = {'type': 'rooms_update', 'rooms': rooms}
    for channel_name in list(connected_users.values()):
        async_to_sync(channel_layer.send)(channel_name, payload)

def admin_stats(request):
    total_messages = Message.objects.count()
    total_rooms = Room.objects.count() + 1
    online_users = list(connected_users.keys())

    return JsonResponse({
        'online_users': online_users,
        'online_count': len(online_users),
        'total_messages': total_messages,
        'total_rooms': total_rooms,
    })

@csrf_exempt
def create_room(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        name = data.get('name', '').strip().replace(' ', '-').lower()
        description = data.get('description', '')
        if name:
            Room.objects.get_or_create(name=name, defaults={'description': description})
            broadcast_rooms_update()
            return JsonResponse({'success': True})
    return JsonResponse({'success': False})


class ChatFileUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'Aucun fichier.'}, status=http_status.HTTP_400_BAD_REQUEST)
        ext = file_obj.name.rsplit('.', 1)[-1] if '.' in file_obj.name else ''
        stored_name = f'chat_files/{uuid.uuid4().hex}.{ext}' if ext else f'chat_files/{uuid.uuid4().hex}'
        saved_path = default_storage.save(stored_name, file_obj)
        return Response({'url': settings.MEDIA_URL + saved_path, 'name': file_obj.name})


def _mark_room_read(request_user, other_matricule, room):
    unread_qs = Message.objects.filter(room=room, read=False).exclude(username=request_user.matricule)
    had_unread = unread_qs.exists()
    unread_qs.update(read=True)
    if had_unread and other_matricule in connected_users:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.send)(connected_users[other_matricule], {
            'type': 'messages_read',
            'room': room,
            'by': request_user.matricule,
        })


def _conversation_row(request_user, other):
    room = f'pm_{"_".join(sorted([request_user.matricule, other.matricule]))}'
    last = Message.objects.filter(room=room).order_by('-timestamp').first()
    if not last:
        return None
    is_online = other.matricule in connected_users
    unread_count = Message.objects.filter(room=room, read=False).exclude(username=request_user.matricule).count()
    last_message_mine = last.username == request_user.matricule
    return {
        'matricule': other.matricule,
        'first_name': other.first_name,
        'last_name': other.last_name,
        'photo': other.photo.url if other.photo else None,
        'online': is_online and other.show_online_status != other.VISIBILITY_NOBODY,
        'last_message': 'Message supprimé' if last.deleted else (last.content or ('Pièce jointe' if last.file_name else '')),
        'last_message_mine': last_message_mine,
        'last_message_read': last.read if last_message_mine else None,
        'last_timestamp': last.timestamp,
        'unread_count': unread_count,
    }


class ConversationsListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from social.models import Friendship
        from social.views import are_blocked

        others = {}

        friend_rows = Friendship.objects.filter(
            Q(from_user=request.user) | Q(to_user=request.user),
        ).exclude(status=Friendship.STATUS_PENDING).select_related('from_user', 'to_user')
        for row in friend_rows:
            other = row.to_user if row.from_user_id == request.user.id else row.from_user
            if row.status == Friendship.STATUS_BLOCKED and are_blocked(request.user, other):
                continue
            others[other.id] = other

        accepted_convos = Conversation.objects.filter(
            Q(user_a=request.user) | Q(user_b=request.user),
            status=Conversation.STATUS_ACCEPTED,
        ).select_related('user_a', 'user_b')
        for convo in accepted_convos:
            other = convo.user_b if convo.user_a_id == request.user.id else convo.user_a
            others.setdefault(other.id, other)

        result = [row for other in others.values() if (row := _conversation_row(request.user, other))]
        result.sort(key=lambda c: c['last_timestamp'], reverse=True)
        return Response(result)


class MessageRequestsListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        convos = Conversation.objects.filter(
            Q(user_a=request.user) | Q(user_b=request.user),
            status=Conversation.STATUS_PENDING,
        ).exclude(initiated_by=request.user).select_related('user_a', 'user_b')

        result = []
        for convo in convos:
            other = convo.user_b if convo.user_a_id == request.user.id else convo.user_a
            row = _conversation_row(request.user, other)
            if row:
                result.append(row)
        result.sort(key=lambda c: c['last_timestamp'], reverse=True)
        return Response(result)


class ConversationStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, matricule):
        from social.views import are_friends

        from accounts.models import User
        other = get_object_or_404(User, matricule=matricule)
        if are_friends(request.user, other):
            return Response({'status': 'accepted', 'is_friend': True})

        convo = Conversation.objects.filter(
            Q(user_a=request.user, user_b=other) | Q(user_a=other, user_b=request.user),
        ).first()
        if not convo:
            return Response({'status': 'none', 'is_friend': False})
        return Response({
            'status': convo.status,
            'is_friend': False,
            'initiated_by_me': convo.initiated_by_id == request.user.id,
        })


class ConversationAcceptView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, matricule):
        from accounts.models import User
        other = get_object_or_404(User, matricule=matricule)
        updated = Conversation.objects.filter(
            Q(user_a=request.user, user_b=other) | Q(user_a=other, user_b=request.user),
            status=Conversation.STATUS_PENDING,
        ).exclude(initiated_by=request.user).update(status=Conversation.STATUS_ACCEPTED)
        if not updated:
            return Response({'detail': 'Aucune demande en attente.'}, status=http_status.HTTP_404_NOT_FOUND)
        return Response({'detail': 'Conversation acceptée.'})


class ConversationDeclineView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, matricule):
        from accounts.models import User
        other = get_object_or_404(User, matricule=matricule)
        deleted, _ = Conversation.objects.filter(
            Q(user_a=request.user, user_b=other) | Q(user_a=other, user_b=request.user),
            status=Conversation.STATUS_PENDING,
        ).exclude(initiated_by=request.user).delete()
        if not deleted:
            return Response({'detail': 'Aucune demande en attente.'}, status=http_status.HTTP_404_NOT_FOUND)
        room = f'pm_{"_".join(sorted([request.user.matricule, matricule]))}'
        Message.objects.filter(room=room).delete()
        return Response({'detail': 'Demande refusée.'})


class ConversationMessagesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, matricule):
        room = f'pm_{"_".join(sorted([request.user.matricule, matricule]))}'
        _mark_room_read(request.user, matricule, room)
        messages = list(Message.objects.filter(room=room).order_by('timestamp')[:100])

        message_ids = [m.id for m in messages]
        reactions_by_message = {}
        for row in MessageReaction.objects.filter(message_id__in=message_ids).values('message_id', 'emoji').annotate(count=Count('id')):
            reactions_by_message.setdefault(row['message_id'], {})[row['emoji']] = row['count']
        my_reactions = dict(
            MessageReaction.objects.filter(message_id__in=message_ids, username=request.user.matricule).values_list('message_id', 'emoji')
        )

        return Response([
            {
                'id': m.id,
                'username': m.username,
                'content': m.content,
                'file_url': m.file_url,
                'file_name': m.file_name,
                'timestamp': m.timestamp,
                'read': m.read,
                'edited': m.edited,
                'deleted': m.deleted,
                'reactions': reactions_by_message.get(m.id, {}),
                'my_reaction': my_reactions.get(m.id),
            }
            for m in messages
        ])


class ConversationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, matricule):
        room = f'pm_{"_".join(sorted([request.user.matricule, matricule]))}'
        _mark_room_read(request.user, matricule, room)
        return Response({'detail': 'ok'})


def _creator_conversation_summaries(matricule=None):
    from accounts.models import User
    from social.models import Group

    pm_qs = Message.objects.filter(room__startswith='pm_')
    group_qs = Message.objects.filter(room__startswith='group_')
    if matricule:
        rooms_with_user = set(
            Message.objects.filter(username=matricule).order_by().values_list('room', flat=True).distinct()
        )
        pm_qs = pm_qs.filter(room__in=rooms_with_user)
        group_qs = group_qs.filter(room__in=rooms_with_user)

    pm_rows = list(pm_qs.order_by().values('room').annotate(count=Count('id'), last_ts=Max('timestamp')))
    group_rows = list(group_qs.order_by().values('room').annotate(count=Count('id'), last_ts=Max('timestamp')))

    first_names = dict(User.objects.values_list('matricule', 'first_name'))
    last_names = dict(User.objects.values_list('matricule', 'last_name'))
    group_names = dict(Group.objects.values_list('id', 'name'))

    conversations = []
    for row in pm_rows:
        room = row['room']
        participants = list(Message.objects.filter(room=room).order_by().values_list('username', flat=True).distinct())
        last = Message.objects.filter(room=room).order_by('-timestamp').first()
        conversations.append({
            'room': room,
            'type': 'private',
            'participants': [
                {'matricule': m, 'first_name': first_names.get(m, m), 'last_name': last_names.get(m, '')}
                for m in participants
            ],
            'message_count': row['count'],
            'last_message': 'Message supprimé' if last.deleted else (last.content or ('Pièce jointe' if last.file_name else '')),
            'last_timestamp': row['last_ts'],
        })

    for row in group_rows:
        room = row['room']
        try:
            group_id = int(room[len('group_'):])
        except ValueError:
            group_id = None
        last = Message.objects.filter(room=room).order_by('-timestamp').first()
        conversations.append({
            'room': room,
            'type': 'group',
            'group_id': group_id,
            'group_name': group_names.get(group_id, 'Groupe supprimé'),
            'message_count': row['count'],
            'last_message': 'Message supprimé' if last.deleted else (last.content or ('Pièce jointe' if last.file_name else '')),
            'last_timestamp': row['last_ts'],
        })

    conversations.sort(key=lambda c: c['last_timestamp'], reverse=True)
    return conversations


class CreatorConversationsView(APIView):
    permission_classes = [IsCreator]

    def get(self, request):
        return Response(_creator_conversation_summaries())


class CreatorUserConversationsView(APIView):
    permission_classes = [IsCreator]

    def get(self, request, matricule):
        return Response(_creator_conversation_summaries(matricule=matricule))


class CreatorRoomMessagesView(APIView):
    permission_classes = [IsCreator]

    def get(self, request, room):
        from accounts.models import User

        messages = list(Message.objects.filter(room=room).order_by('timestamp')[:500])
        matricules = {m.username for m in messages}
        names = dict(User.objects.filter(matricule__in=matricules).values_list('matricule', 'first_name'))

        return Response([
            {
                'id': m.id,
                'username': m.username,
                'display_name': names.get(m.username, m.username),
                'content': m.content,
                'file_url': m.file_url,
                'file_name': m.file_name,
                'timestamp': m.timestamp,
                'edited': m.edited,
                'deleted': m.deleted,
            }
            for m in messages
        ])


class CreatorDeleteMessageView(APIView):
    permission_classes = [IsCreator]

    def post(self, request, message_id):
        try:
            message = Message.objects.get(id=message_id)
        except Message.DoesNotExist:
            return Response({'detail': 'Message introuvable.'}, status=http_status.HTTP_404_NOT_FOUND)

        message.content = ''
        message.file_url = ''
        message.file_name = ''
        message.deleted = True
        message.save(update_fields=['content', 'file_url', 'file_name', 'deleted'])

        room = message.room
        channel_layer = get_channel_layer()
        if room.startswith('group_'):
            try:
                group_id = int(room[len('group_'):])
            except ValueError:
                group_id = None
            async_to_sync(channel_layer.group_send)(room, {'type': 'message_deleted', 'id': message_id, 'group_id': group_id})
        elif room.startswith('pm_'):
            for matricule in room[len('pm_'):].split('_'):
                if matricule in connected_users:
                    async_to_sync(channel_layer.send)(
                        connected_users[matricule], {'type': 'message_deleted', 'id': message_id, 'group_id': None},
                    )

        return Response({'detail': 'Message supprimé.'})