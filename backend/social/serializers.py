from rest_framework import serializers
from accounts.models import User
from accounts.serializers import UserSerializer, RelativeImageField, RelativeFileField
from .models import Friendship, Status, StatusView, Report, Announcement, Event, Notification, Group, TimetableEntry, Poll, PollOption


class FriendshipSerializer(serializers.ModelSerializer):
    from_user = UserSerializer(read_only=True)
    to_user = UserSerializer(read_only=True)

    class Meta:
        model = Friendship
        fields = ['id', 'from_user', 'to_user', 'status', 'created_at']


class StatusSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    image = RelativeImageField(required=False, allow_null=True)
    viewed_by_me = serializers.SerializerMethodField()
    view_count = serializers.SerializerMethodField()

    class Meta:
        model = Status
        fields = [
            'id', 'author', 'text', 'image', 'visibility', 'created_at', 'expires_at',
            'viewed_by_me', 'view_count',
        ]
        read_only_fields = ['created_at', 'expires_at']

    def get_viewed_by_me(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if obj.author_id == request.user.id:
            return True
        return StatusView.objects.filter(status=obj, viewer=request.user).exists()

    def get_view_count(self, obj):
        request = self.context.get('request')
        if not request or obj.author_id != request.user.id:
            return None
        return obj.views.count()


class ReportSerializer(serializers.ModelSerializer):
    reporter = UserSerializer(read_only=True)
    reported_user = UserSerializer(read_only=True)

    class Meta:
        model = Report
        fields = ['id', 'reporter', 'reported_user', 'reason', 'status', 'created_at']


class AnnouncementSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    can_delete = serializers.SerializerMethodField()
    file = RelativeFileField(required=False, allow_null=True)

    class Meta:
        model = Announcement
        fields = ['id', 'title', 'content', 'author', 'group', 'is_urgent', 'file', 'created_at', 'can_delete']
        read_only_fields = ['group']

    def get_can_delete(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        is_staff = request.user.role in (User.ROLE_TEACHER, User.ROLE_ADMIN_STAFF, User.ROLE_MAIN_ADMIN)
        is_author = obj.author_id == request.user.id
        return is_staff or (is_author and not obj.is_urgent)


class EventSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Event
        fields = ['id', 'title', 'description', 'date', 'location', 'author']


class GroupSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    member_count = serializers.IntegerField(read_only=True)
    is_member = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    leave_requested = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            'id', 'name', 'description', 'kind', 'filiere', 'niveau', 'is_system',
            'created_by', 'created_at', 'member_count', 'is_member', 'is_admin', 'leave_requested',
        ]
        read_only_fields = ['is_system']
        validators = []

    def get_is_member(self, obj):
        user = self.context['request'].user
        return obj.memberships.filter(user=user).exists()

    def get_is_admin(self, obj):
        user = self.context['request'].user
        return obj.memberships.filter(user=user, role='admin').exists()

    def get_leave_requested(self, obj):
        user = self.context['request'].user
        membership = obj.memberships.filter(user=user).first()
        return bool(membership and membership.leave_requested)


class TimetableEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = TimetableEntry
        fields = ['id', 'filiere', 'niveau', 'day', 'start_time', 'end_time', 'subject', 'room']


class PollOptionSerializer(serializers.ModelSerializer):
    vote_count = serializers.SerializerMethodField()

    class Meta:
        model = PollOption
        fields = ['id', 'text', 'vote_count']

    def get_vote_count(self, obj):
        return obj.votes.count()


class PollSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    options = PollOptionSerializer(many=True, read_only=True)
    total_votes = serializers.SerializerMethodField()
    my_vote = serializers.SerializerMethodField()

    class Meta:
        model = Poll
        fields = ['id', 'group', 'question', 'created_by', 'created_at', 'closed', 'options', 'total_votes', 'my_vote']
        read_only_fields = ['group', 'closed']

    def get_total_votes(self, obj):
        return obj.votes.count()

    def get_my_vote(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        vote = obj.votes.filter(user=request.user).first()
        return vote.option_id if vote else None


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'type', 'message', 'related_id', 'read', 'created_at']
