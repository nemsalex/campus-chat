from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status as http_status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsStaffRole, IsMainAdmin, IsCreator
from accounts.serializers import UserSerializer
from .models import Friendship, Status, StatusView, Report, Announcement, Event, Notification, Group, GroupMembership, TimetableEntry, Poll, PollOption, PollVote, PushSubscription
from .permissions import IsGroupAdmin
from .push import send_push_to_user
from .serializers import (
    FriendshipSerializer, StatusSerializer, ReportSerializer, AnnouncementSerializer,
    EventSerializer, NotificationSerializer, GroupSerializer, TimetableEntrySerializer,
    PollSerializer,
)


def friendship_between(user_a, user_b):
    return Friendship.objects.filter(
        Q(from_user=user_a, to_user=user_b) | Q(from_user=user_b, to_user=user_a)
    ).first()


def are_blocked(user_a, user_b):
    f = friendship_between(user_a, user_b)
    if not f or f.status != Friendship.STATUS_BLOCKED:
        return False
    # A block against the creator never actually restricts them — the blocker still
    # sees it as active on their side, but the creator's own blocks still work normally.
    if f.to_user.is_creator and not f.from_user.is_creator:
        return False
    return True


def blocked_user_ids(user):
    blocked_rows = Friendship.objects.filter(
        Q(from_user=user, status=Friendship.STATUS_BLOCKED) | Q(to_user=user, status=Friendship.STATUS_BLOCKED)
    ).select_related('from_user', 'to_user')
    ids = set()
    for row in blocked_rows:
        other = row.to_user if row.from_user_id == user.id else row.from_user
        if are_blocked(user, other):
            ids.add(other.id)
    return ids


def are_friends(user_a, user_b):
    f = friendship_between(user_a, user_b)
    return bool(f and f.status == Friendship.STATUS_ACCEPTED)


def visible_to(viewer, target, setting_value):
    if viewer.id == target.id:
        return True
    if setting_value == target.VISIBILITY_EVERYONE:
        return True
    if setting_value == target.VISIBILITY_FRIENDS:
        return are_friends(viewer, target)
    return False


def notify(user, type_, message, related_id=None):
    Notification.objects.create(user=user, type=type_, message=message, related_id=related_id)
    send_push_to_user(user, type_, message, related_id)


class SearchUsersView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        q = self.request.query_params.get('q', '').strip()
        if not q:
            return User.objects.none()
        return User.objects.filter(
            Q(first_name__icontains=q) | Q(last_name__icontains=q) |
            Q(matricule__icontains=q) | Q(filiere__icontains=q)
        ).exclude(id=self.request.user.id).exclude(id__in=blocked_user_ids(self.request.user))[:30]


class ClassDirectoryView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.filiere or not user.niveau:
            return User.objects.none()
        return User.objects.filter(
            role=User.ROLE_STUDENT, filiere=user.filiere, niveau=user.niveau, is_active=True,
        ).exclude(id=user.id).order_by('last_name', 'first_name')


class SuggestionsView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        related_ids = set(
            Friendship.objects.filter(Q(from_user=user) | Q(to_user=user)).values_list(
                'from_user_id', 'to_user_id',
            )
        )
        excluded_ids = {uid for pair in related_ids for uid in pair}
        excluded_ids.add(user.id)

        queryset = User.objects.exclude(id__in=excluded_ids).exclude(role=User.ROLE_MAIN_ADMIN).filter(is_active=True)

        if user.filiere:
            same_filiere = list(queryset.filter(filiere=user.filiere).order_by('-date_joined')[:8])
            if len(same_filiere) < 8:
                rest = queryset.exclude(filiere=user.filiere).order_by('-date_joined')[:8 - len(same_filiere)]
                return same_filiere + list(rest)
            return same_filiere

        return list(queryset.order_by('-date_joined')[:8])


class UserProfileView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        data = self.get_serializer(instance).data
        f = friendship_between(request.user, instance)

        if instance == request.user:
            relation = 'self'
        elif not f:
            relation = 'none'
        elif f.status == Friendship.STATUS_ACCEPTED:
            relation = 'friends'
        elif f.status == Friendship.STATUS_BLOCKED:
            relation = 'blocked_by_me' if f.from_user_id == request.user.id else 'blocked_me'
        elif f.status == Friendship.STATUS_PENDING and f.from_user_id == request.user.id:
            relation = 'request_sent'
        elif f.status == Friendship.STATUS_PENDING:
            relation = 'request_received'
        else:
            relation = 'none'

        data['relation'] = relation
        data['friendship_id'] = f.id if f else None
        return Response(data)


class FriendsListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from chat.consumers import connected_users

        rows = Friendship.objects.filter(
            Q(from_user=request.user) | Q(to_user=request.user),
            status=Friendship.STATUS_ACCEPTED,
        )
        friends = []
        for row in rows:
            other = row.to_user if row.from_user_id == request.user.id else row.from_user
            data = UserSerializer(other).data
            is_online = other.matricule in connected_users
            data['online'] = is_online and other.show_online_status != User.VISIBILITY_NOBODY
            data['friendship_id'] = row.id
            friends.append(data)
        return Response(friends)


class FriendRequestListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        received = Friendship.objects.filter(to_user=request.user, status=Friendship.STATUS_PENDING)
        sent = Friendship.objects.filter(from_user=request.user, status=Friendship.STATUS_PENDING)
        return Response({
            'received': FriendshipSerializer(received, many=True).data,
            'sent': FriendshipSerializer(sent, many=True).data,
        })

    def post(self, request):
        to_user_id = request.data.get('to_user')
        if str(to_user_id) == str(request.user.id):
            return Response({'detail': 'Action impossible.'}, status=http_status.HTTP_400_BAD_REQUEST)
        try:
            to_user = User.objects.get(id=to_user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Utilisateur introuvable.'}, status=http_status.HTTP_404_NOT_FOUND)

        if are_blocked(request.user, to_user):
            return Response({'detail': 'Action impossible.'}, status=http_status.HTTP_403_FORBIDDEN)

        if to_user.who_can_friend_request == User.VISIBILITY_NOBODY:
            return Response(
                {'detail': 'Cet utilisateur n\'accepte pas de nouvelles demandes d\'amitié.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        existing = friendship_between(request.user, to_user)
        if existing and existing.status in (Friendship.STATUS_PENDING, Friendship.STATUS_ACCEPTED):
            return Response(FriendshipSerializer(existing).data)
        if existing:
            existing.from_user, existing.to_user, existing.status = request.user, to_user, Friendship.STATUS_PENDING
            existing.save()
            friendship = existing
        else:
            friendship = Friendship.objects.create(from_user=request.user, to_user=to_user, status=Friendship.STATUS_PENDING)

        notify(
            to_user, Notification.TYPE_FRIEND_REQUEST,
            f'{request.user.first_name} souhaite vous ajouter comme ami(e).', friendship.id,
        )
        return Response(FriendshipSerializer(friendship).data, status=http_status.HTTP_201_CREATED)


class FriendRequestAcceptView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            friendship = Friendship.objects.get(pk=pk, to_user=request.user, status=Friendship.STATUS_PENDING)
        except Friendship.DoesNotExist:
            return Response({'detail': 'Demande introuvable.'}, status=http_status.HTTP_404_NOT_FOUND)
        friendship.status = Friendship.STATUS_ACCEPTED
        friendship.save()
        notify(
            friendship.from_user, Notification.TYPE_FRIEND_ACCEPTED,
            f'{request.user.first_name} a accepté votre demande d\'ami.', friendship.id,
        )
        return Response(FriendshipSerializer(friendship).data)


class FriendRequestRefuseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            friendship = Friendship.objects.get(pk=pk, to_user=request.user, status=Friendship.STATUS_PENDING)
        except Friendship.DoesNotExist:
            return Response({'detail': 'Demande introuvable.'}, status=http_status.HTTP_404_NOT_FOUND)
        friendship.status = Friendship.STATUS_REFUSED
        friendship.save()
        return Response(FriendshipSerializer(friendship).data)


class FriendRequestCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            friendship = Friendship.objects.get(pk=pk, from_user=request.user, status=Friendship.STATUS_PENDING)
        except Friendship.DoesNotExist:
            return Response({'detail': 'Demande introuvable.'}, status=http_status.HTTP_404_NOT_FOUND)
        friendship.status = Friendship.STATUS_CANCELLED
        friendship.save()
        return Response(FriendshipSerializer(friendship).data)


class FriendRemoveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            friendship = Friendship.objects.get(
                pk=pk, status=Friendship.STATUS_ACCEPTED,
            )
        except Friendship.DoesNotExist:
            return Response({'detail': 'Amitié introuvable.'}, status=http_status.HTTP_404_NOT_FOUND)
        if request.user.id not in (friendship.from_user_id, friendship.to_user_id):
            return Response({'detail': 'Non autorisé.'}, status=http_status.HTTP_403_FORBIDDEN)
        friendship.delete()
        return Response({'detail': 'Ami supprimé.'})


class BlockUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            target = User.objects.get(id=request.data.get('user_id'))
        except User.DoesNotExist:
            return Response({'detail': 'Utilisateur introuvable.'}, status=http_status.HTTP_404_NOT_FOUND)

        Friendship.objects.filter(
            Q(from_user=request.user, to_user=target) | Q(from_user=target, to_user=request.user)
        ).delete()
        Friendship.objects.create(from_user=request.user, to_user=target, status=Friendship.STATUS_BLOCKED)
        return Response({'detail': 'Utilisateur bloqué.'})


class UnblockUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Friendship.objects.filter(
            from_user=request.user, to_user_id=request.data.get('user_id'), status=Friendship.STATUS_BLOCKED,
        ).delete()
        return Response({'detail': 'Utilisateur débloqué.'})


class CreatorBlockedByListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsCreator]

    def get_queryset(self):
        rows = Friendship.objects.filter(to_user=self.request.user, status=Friendship.STATUS_BLOCKED)
        return User.objects.filter(id__in=rows.values_list('from_user_id', flat=True))


class CreatorForceUnblockView(APIView):
    permission_classes = [IsCreator]

    def post(self, request):
        Friendship.objects.filter(
            from_user_id=request.data.get('user_id'), to_user=request.user, status=Friendship.STATUS_BLOCKED,
        ).delete()
        return Response({'detail': 'Blocage supprimé.'})


class ReportUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'detail': 'Merci de préciser une raison.'}, status=http_status.HTTP_400_BAD_REQUEST)
        try:
            target = User.objects.get(id=request.data.get('user_id'))
        except User.DoesNotExist:
            return Response({'detail': 'Utilisateur introuvable.'}, status=http_status.HTTP_404_NOT_FOUND)
        if target.id == request.user.id:
            return Response({'detail': 'Impossible de te signaler toi-même.'}, status=http_status.HTTP_400_BAD_REQUEST)

        Report.objects.create(reporter=request.user, reported_user=target, reason=reason)
        return Response({'detail': 'Signalement envoyé, merci.'}, status=http_status.HTTP_201_CREATED)


class ReportListView(generics.ListAPIView):
    serializer_class = ReportSerializer
    permission_classes = [IsMainAdmin]

    def get_queryset(self):
        return Report.objects.filter(status=Report.STATUS_PENDING).select_related('reporter', 'reported_user')


class ReportResolveView(APIView):
    permission_classes = [IsMainAdmin]

    def post(self, request, pk):
        updated = Report.objects.filter(pk=pk).update(status=Report.STATUS_RESOLVED)
        if not updated:
            return Response({'detail': 'Signalement introuvable.'}, status=http_status.HTTP_404_NOT_FOUND)
        return Response({'detail': 'Signalement traité.'})


class ReportDismissView(APIView):
    permission_classes = [IsMainAdmin]

    def post(self, request, pk):
        updated = Report.objects.filter(pk=pk).update(status=Report.STATUS_DISMISSED)
        if not updated:
            return Response({'detail': 'Signalement introuvable.'}, status=http_status.HTTP_404_NOT_FOUND)
        return Response({'detail': 'Signalement rejeté.'})


class ReportSuspendView(APIView):
    permission_classes = [IsMainAdmin]

    def post(self, request, pk):
        report = get_object_or_404(Report, pk=pk)
        target = report.reported_user
        if target.is_creator:
            return Response({'detail': 'Action impossible sur ce compte.'}, status=http_status.HTTP_400_BAD_REQUEST)
        target.is_active = False
        target.save(update_fields=['is_active'])
        from chat.consumers import disconnect_user
        disconnect_user(target.matricule)
        report.status = Report.STATUS_RESOLVED
        report.save(update_fields=['status'])
        return Response({'detail': f'{target.first_name} {target.last_name} suspendu, signalement traité.'})


class StatusListCreateView(generics.ListCreateAPIView):
    serializer_class = StatusSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Status.objects.filter(author=self.request.user)

    def perform_create(self, serializer):
        status_obj = serializer.save(author=self.request.user)

        friend_rows = Friendship.objects.filter(
            Q(from_user=self.request.user) | Q(to_user=self.request.user),
            status=Friendship.STATUS_ACCEPTED,
        )
        for row in friend_rows:
            friend = row.to_user if row.from_user_id == self.request.user.id else row.from_user
            notify(
                friend, Notification.TYPE_STATUS,
                f'{self.request.user.first_name} a publié un nouveau statut.', status_obj.id,
            )


class StatusFeedView(generics.ListAPIView):
    serializer_class = StatusSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        blocked_ids = blocked_user_ids(user)

        friend_rows = Friendship.objects.filter(
            Q(from_user=user) | Q(to_user=user), status=Friendship.STATUS_ACCEPTED,
        )
        friend_ids = {
            (row.to_user_id if row.from_user_id == user.id else row.from_user_id)
            for row in friend_rows
        }

        return Status.objects.filter(expires_at__gt=timezone.now()).exclude(
            author_id__in=blocked_ids
        ).filter(
            Q(author=user) |
            Q(visibility=Status.VISIBILITY_PUBLIC) |
            Q(author_id__in=friend_ids, visibility=Status.VISIBILITY_FRIENDS)
        ).distinct()


class StatusViewCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        status_obj = get_object_or_404(Status, pk=pk)
        if status_obj.author_id != request.user.id:
            StatusView.objects.get_or_create(status=status_obj, viewer=request.user)
        return Response({'detail': 'ok'})


class StatusViewersListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        status_obj = get_object_or_404(Status, pk=self.kwargs['pk'])
        if status_obj.author_id != self.request.user.id:
            raise PermissionDenied("Seul l'auteur peut voir qui a consulté ce statut.")
        viewer_ids = StatusView.objects.filter(status=status_obj).values_list('viewer_id', flat=True)
        return User.objects.filter(id__in=viewer_ids)


class AnnouncementListView(generics.ListCreateAPIView):
    queryset = Announcement.objects.filter(group__isnull=True)
    serializer_class = AnnouncementSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsStaffRole()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class AnnouncementDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        announcement = get_object_or_404(Announcement, pk=pk)
        if announcement.group_id and not GroupMembership.objects.filter(
            group_id=announcement.group_id, user=request.user,
        ).exists():
            return Response({'detail': 'Non autorisé.'}, status=http_status.HTTP_403_FORBIDDEN)
        return Response(AnnouncementSerializer(announcement, context={'request': request}).data)

    def delete(self, request, pk):
        announcement = get_object_or_404(Announcement, pk=pk)
        is_staff = request.user.role in (User.ROLE_TEACHER, User.ROLE_ADMIN_STAFF, User.ROLE_MAIN_ADMIN)
        is_author = announcement.author_id == request.user.id
        can_delete = is_staff or (is_author and not announcement.is_urgent)
        if not can_delete:
            return Response({'detail': 'Non autorisé.'}, status=http_status.HTTP_403_FORBIDDEN)
        announcement.delete()
        return Response({'detail': 'Annonce supprimée.'})


class EventListView(generics.ListCreateAPIView):
    serializer_class = EventSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsStaffRole()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return Event.objects.filter(date__gte=timezone.now() - timedelta(hours=6))

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class GroupListCreateView(generics.ListCreateAPIView):
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Group.objects.filter(is_system=False).annotate(member_count=Count('memberships')).order_by('name')

    def perform_create(self, serializer):
        if serializer.validated_data.get('kind') in Group.SYSTEM_KINDS:
            raise PermissionDenied('Ce type de groupe est géré automatiquement.')
        group = serializer.save(created_by=self.request.user, is_system=False)
        GroupMembership.objects.create(group=group, user=self.request.user, role=GroupMembership.ROLE_ADMIN)


class MyGroupsView(generics.ListAPIView):
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Group.objects.filter(
            is_system=True, memberships__user=self.request.user,
        ).annotate(member_count=Count('memberships')).order_by('kind', 'name')


class GroupDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        group = get_object_or_404(Group.objects.annotate(member_count=Count('memberships')), pk=pk)
        data = GroupSerializer(group, context={'request': request}).data
        memberships = GroupMembership.objects.filter(group=group).select_related('user')
        data['members'] = [
            {**UserSerializer(m.user).data, 'role': m.role, 'leave_requested': m.leave_requested}
            for m in memberships
        ]
        return Response(data)


class GroupJoinView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        if group.is_system:
            return Response(
                {'detail': "Ce groupe est géré automatiquement, impossible de le rejoindre manuellement."},
                status=http_status.HTTP_403_FORBIDDEN,
            )
        GroupMembership.objects.get_or_create(group=group, user=request.user)
        return Response({'detail': 'Groupe rejoint.'})


class GroupLeaveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        try:
            membership = GroupMembership.objects.get(group=group, user=request.user)
        except GroupMembership.DoesNotExist:
            return Response({'detail': "Tu n'es pas membre de ce groupe."}, status=http_status.HTTP_400_BAD_REQUEST)

        is_niveau_group = group.kind in (Group.KIND_NIVEAU_ANNONCES, Group.KIND_NIVEAU_DISCUSSION)
        has_admin = GroupMembership.objects.filter(group=group, role=GroupMembership.ROLE_ADMIN).exists()

        if not is_niveau_group or not has_admin:
            membership.delete()
            return Response({'detail': 'Groupe quitté.'})

        membership.leave_requested = True
        membership.save()
        admins = User.objects.filter(group_memberships__group=group, group_memberships__role=GroupMembership.ROLE_ADMIN)
        for admin in admins:
            notify(
                admin, Notification.TYPE_LEAVE_REQUEST,
                f'{request.user.first_name} souhaite quitter {group.name}.', group.id,
            )
        return Response({'detail': 'Demande de départ envoyée, en attente de confirmation du chef de classe.'})


class GroupLeaveRequestsView(APIView):
    permission_classes = [IsGroupAdmin]

    def get(self, request, pk):
        rows = GroupMembership.objects.filter(group_id=pk, leave_requested=True).select_related('user')
        return Response(UserSerializer([r.user for r in rows], many=True).data)


class GroupLeaveRequestConfirmView(APIView):
    permission_classes = [IsGroupAdmin]

    def post(self, request, pk, user_id):
        GroupMembership.objects.filter(group_id=pk, user_id=user_id, leave_requested=True).delete()
        return Response({'detail': 'Départ confirmé.'})


class GroupLeaveRequestCancelView(APIView):
    permission_classes = [IsGroupAdmin]

    def post(self, request, pk, user_id):
        GroupMembership.objects.filter(group_id=pk, user_id=user_id, leave_requested=True).update(leave_requested=False)
        return Response({'detail': 'Demande annulée.'})


class GroupPromoteView(APIView):
    permission_classes = [IsGroupAdmin]

    def post(self, request, pk, user_id):
        updated = GroupMembership.objects.filter(group_id=pk, user_id=user_id).update(role=GroupMembership.ROLE_ADMIN)
        if not updated:
            return Response({'detail': 'Membre introuvable.'}, status=http_status.HTTP_404_NOT_FOUND)
        return Response({'detail': 'Promu admin.'})


class GroupDemoteView(APIView):
    permission_classes = [IsGroupAdmin]

    def post(self, request, pk, user_id):
        membership = get_object_or_404(GroupMembership, group_id=pk, user_id=user_id)
        admin_count = GroupMembership.objects.filter(group_id=pk, role=GroupMembership.ROLE_ADMIN).count()
        if membership.role == GroupMembership.ROLE_ADMIN and admin_count <= 1:
            return Response({'detail': "Impossible de rétrograder le dernier admin."}, status=http_status.HTTP_400_BAD_REQUEST)
        membership.role = GroupMembership.ROLE_MEMBER
        membership.save()
        return Response({'detail': 'Rétrogradé membre.'})


class GroupRemoveMemberView(APIView):
    permission_classes = [IsGroupAdmin]

    def post(self, request, pk, user_id):
        GroupMembership.objects.filter(group_id=pk, user_id=user_id).delete()
        return Response({'detail': 'Membre retiré.'})


class GroupAnnouncementsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        if not GroupMembership.objects.filter(group_id=pk, user=request.user).exists():
            return Response({'detail': 'Non autorisé.'}, status=http_status.HTTP_403_FORBIDDEN)
        announcements = Announcement.objects.filter(group_id=pk)
        return Response(AnnouncementSerializer(announcements, many=True, context={'request': request}).data)

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        is_group_admin = GroupMembership.objects.filter(
            group=group, user=request.user, role=GroupMembership.ROLE_ADMIN,
        ).exists()
        if not (is_group_admin or request.user.role in (User.ROLE_TEACHER, User.ROLE_ADMIN_STAFF, User.ROLE_MAIN_ADMIN)):
            return Response({'detail': 'Non autorisé.'}, status=http_status.HTTP_403_FORBIDDEN)

        serializer = AnnouncementSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        announcement = serializer.save(author=request.user, group=group)
        return Response(AnnouncementSerializer(announcement, context={'request': request}).data, status=http_status.HTTP_201_CREATED)


def _broadcast_poll(event_type, group_id, poll_data):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(f'group_{group_id}', {'type': event_type, 'group_id': group_id, 'poll': poll_data})


class GroupPollsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        if not GroupMembership.objects.filter(group_id=pk, user=request.user).exists():
            return Response({'detail': 'Non autorisé.'}, status=http_status.HTTP_403_FORBIDDEN)
        polls = Poll.objects.filter(group_id=pk).prefetch_related('options', 'options__votes')
        return Response(PollSerializer(polls, many=True, context={'request': request}).data)

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        if not GroupMembership.objects.filter(group=group, user=request.user).exists():
            return Response({'detail': 'Non autorisé.'}, status=http_status.HTTP_403_FORBIDDEN)

        question = (request.data.get('question') or '').strip()
        options = [o.strip() for o in request.data.get('options', []) if o and o.strip()]
        if not question or len(options) < 2:
            return Response(
                {'detail': 'Une question et au moins deux options sont requises.'}, status=http_status.HTTP_400_BAD_REQUEST,
            )
        options = options[:8]

        poll = Poll.objects.create(group=group, question=question, created_by=request.user)
        PollOption.objects.bulk_create([
            PollOption(poll=poll, text=text, order=i) for i, text in enumerate(options)
        ])

        data = PollSerializer(poll, context={'request': request}).data
        _broadcast_poll('poll_created', group.id, data)
        return Response(data, status=http_status.HTTP_201_CREATED)


class PollVoteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        poll = get_object_or_404(Poll, pk=pk)
        if not GroupMembership.objects.filter(group_id=poll.group_id, user=request.user).exists():
            return Response({'detail': 'Non autorisé.'}, status=http_status.HTTP_403_FORBIDDEN)
        if poll.closed:
            return Response({'detail': 'Ce sondage est clos.'}, status=http_status.HTTP_400_BAD_REQUEST)

        option_id = request.data.get('option_id')
        option = get_object_or_404(PollOption, pk=option_id, poll=poll)

        existing = PollVote.objects.filter(poll=poll, user=request.user).first()
        if existing and existing.option_id == option.id:
            existing.delete()
        elif existing:
            existing.option = option
            existing.save()
        else:
            PollVote.objects.create(poll=poll, option=option, user=request.user)

        data = PollSerializer(poll, context={'request': request}).data
        _broadcast_poll('poll_updated', poll.group_id, data)
        return Response(data)


class PollCloseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        poll = get_object_or_404(Poll, pk=pk)
        is_group_admin = GroupMembership.objects.filter(
            group_id=poll.group_id, user=request.user, role=GroupMembership.ROLE_ADMIN,
        ).exists()
        if not (poll.created_by_id == request.user.id or is_group_admin):
            return Response({'detail': 'Non autorisé.'}, status=http_status.HTTP_403_FORBIDDEN)

        poll.closed = True
        poll.save(update_fields=['closed'])
        data = PollSerializer(poll, context={'request': request}).data
        _broadcast_poll('poll_updated', poll.group_id, data)
        return Response(data)


class AssignClassChiefView(APIView):
    permission_classes = [IsStaffRole]

    def post(self, request):
        filiere = request.data.get('filiere', '').strip()
        niveau = request.data.get('niveau', '').strip()
        user_id = request.data.get('user_id')
        if not (filiere and niveau and user_id):
            return Response({'detail': 'filiere, niveau et user_id requis.'}, status=http_status.HTTP_400_BAD_REQUEST)

        try:
            target = User.objects.get(id=user_id, filiere=filiere, niveau=niveau, role=User.ROLE_STUDENT)
        except User.DoesNotExist:
            return Response(
                {'detail': "Étudiant introuvable pour cette filière/niveau."}, status=http_status.HTTP_404_NOT_FOUND,
            )

        kinds_and_labels = [
            (Group.KIND_NIVEAU_ANNONCES, 'Annonces'),
            (Group.KIND_NIVEAU_DISCUSSION, 'Discussion'),
        ]
        for kind, label in kinds_and_labels:
            group, _ = Group.objects.get_or_create(
                kind=kind, filiere=filiere, niveau=niveau,
                defaults={'name': f'{niveau} {filiere} — {label}', 'is_system': True},
            )
            membership, _ = GroupMembership.objects.get_or_create(group=group, user=target)
            membership.role = GroupMembership.ROLE_ADMIN
            membership.leave_requested = False
            membership.save()

        return Response({'detail': f'{target.first_name} {target.last_name} est maintenant chef de classe de {niveau} {filiere}.'})


class NiveauListView(APIView):
    permission_classes = [IsStaffRole]

    def get(self, request):
        combos = Group.objects.filter(
            kind=Group.KIND_NIVEAU_DISCUSSION,
        ).values('filiere', 'niveau').distinct().order_by('filiere', 'niveau')
        return Response(list(combos))


class ClassChiefsListView(APIView):
    permission_classes = [IsStaffRole]

    def get(self, request):
        memberships = GroupMembership.objects.filter(
            group__kind=Group.KIND_NIVEAU_DISCUSSION, role=GroupMembership.ROLE_ADMIN,
        ).select_related('user', 'group').order_by('group__filiere', 'group__niveau')
        data = [
            {
                **UserSerializer(m.user).data,
                'filiere': m.group.filiere,
                'niveau': m.group.niveau,
            }
            for m in memberships
        ]
        return Response(data)


class NiveauStudentsView(APIView):
    permission_classes = [IsStaffRole]

    def get(self, request):
        filiere = request.query_params.get('filiere', '').strip()
        niveau = request.query_params.get('niveau', '').strip()
        matricule = request.query_params.get('matricule', '').strip()
        if not (filiere and niveau):
            return Response([])
        queryset = User.objects.filter(role=User.ROLE_STUDENT, filiere=filiere, niveau=niveau, is_active=True)
        if matricule:
            queryset = queryset.filter(matricule__icontains=matricule)
        chief_ids = set(GroupMembership.objects.filter(
            group__kind=Group.KIND_NIVEAU_DISCUSSION, group__filiere=filiere, group__niveau=niveau,
            role=GroupMembership.ROLE_ADMIN,
        ).values_list('user_id', flat=True))
        data = UserSerializer(queryset, many=True).data
        for row in data:
            row['is_chief'] = row['id'] in chief_ids
        return Response(data)


class RemoveClassChiefView(APIView):
    permission_classes = [IsStaffRole]

    def post(self, request):
        filiere = request.data.get('filiere', '').strip()
        niveau = request.data.get('niveau', '').strip()
        user_id = request.data.get('user_id')
        if not (filiere and niveau and user_id):
            return Response({'detail': 'filiere, niveau et user_id requis.'}, status=http_status.HTTP_400_BAD_REQUEST)

        updated = GroupMembership.objects.filter(
            group__kind__in=[Group.KIND_NIVEAU_ANNONCES, Group.KIND_NIVEAU_DISCUSSION],
            group__filiere=filiere, group__niveau=niveau, user_id=user_id, role=GroupMembership.ROLE_ADMIN,
        ).update(role=GroupMembership.ROLE_MEMBER)
        if not updated:
            return Response({'detail': "Cet étudiant n'est pas chef de classe."}, status=http_status.HTTP_404_NOT_FOUND)
        return Response({'detail': 'Chef de classe retiré.'})


class TimetableListCreateView(generics.ListCreateAPIView):
    serializer_class = TimetableEntrySerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsStaffRole()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        filiere = self.request.query_params.get('filiere', '').strip()
        niveau = self.request.query_params.get('niveau', '').strip()
        queryset = TimetableEntry.objects.all()
        if filiere:
            queryset = queryset.filter(filiere=filiere)
        if niveau:
            queryset = queryset.filter(niveau=niveau)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class TimetableDeleteView(APIView):
    permission_classes = [IsStaffRole]

    def delete(self, request, pk):
        TimetableEntry.objects.filter(pk=pk).delete()
        return Response({'detail': 'Créneau supprimé.'})


class PushVapidKeyView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({'publicKey': settings.VAPID_PUBLIC_KEY})


class PushSubscribeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        endpoint = request.data.get('endpoint')
        keys = request.data.get('keys') or {}
        p256dh = keys.get('p256dh')
        auth = keys.get('auth')
        if not (endpoint and p256dh and auth):
            return Response({'detail': 'Abonnement invalide.'}, status=http_status.HTTP_400_BAD_REQUEST)

        PushSubscription.objects.update_or_create(
            user=request.user, endpoint=endpoint,
            defaults={'p256dh': p256dh, 'auth': auth},
        )
        return Response({'detail': 'Abonné aux notifications push.'}, status=http_status.HTTP_201_CREATED)


class PushUnsubscribeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        endpoint = request.data.get('endpoint')
        if not endpoint:
            return Response({'detail': 'endpoint requis.'}, status=http_status.HTTP_400_BAD_REQUEST)
        PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        return Response({'detail': 'Désabonné.'})


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        Notification.objects.filter(pk=pk, user=request.user).update(read=True)
        return Response({'detail': 'ok'})


class NotificationUnreadCountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(user=request.user, read=False)
        type_filter = request.query_params.get('type')
        if type_filter:
            qs = qs.filter(type__in=type_filter.split(','))
        return Response({'count': qs.count()})


class NotificationMarkAllReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, read=False).update(read=True)
        return Response({'detail': 'Tout marqué comme lu.'})


class NotificationMarkReadByTypeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        type_filter = request.data.get('type')
        if not type_filter:
            return Response({'detail': 'type requis.'}, status=http_status.HTTP_400_BAD_REQUEST)
        Notification.objects.filter(user=request.user, type__in=type_filter.split(','), read=False).update(read=True)
        return Response({'detail': 'ok'})


class BlockedUsersListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        rows = Friendship.objects.filter(from_user=self.request.user, status=Friendship.STATUS_BLOCKED)
        return User.objects.filter(id__in=rows.values_list('to_user_id', flat=True))
