from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class Friendship(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_ACCEPTED = 'accepted'
    STATUS_REFUSED = 'refused'
    STATUS_CANCELLED = 'cancelled'
    STATUS_BLOCKED = 'blocked'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'En attente'),
        (STATUS_ACCEPTED, 'Acceptée'),
        (STATUS_REFUSED, 'Refusée'),
        (STATUS_CANCELLED, 'Annulée'),
        (STATUS_BLOCKED, 'Bloquée'),
    ]

    from_user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='sent_friend_requests', on_delete=models.CASCADE)
    to_user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='received_friend_requests', on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('from_user', 'to_user')

    def __str__(self):
        return f'{self.from_user} -> {self.to_user} ({self.status})'


class Status(models.Model):
    VISIBILITY_PUBLIC = 'public'
    VISIBILITY_FRIENDS = 'friends'
    VISIBILITY_CHOICES = [
        (VISIBILITY_PUBLIC, 'Tout le campus'),
        (VISIBILITY_FRIENDS, 'Mes amis'),
    ]

    author = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='statuses', on_delete=models.CASCADE)
    text = models.TextField(blank=True)
    image = models.ImageField(upload_to='statuses/', blank=True, null=True)
    visibility = models.CharField(max_length=10, choices=VISIBILITY_CHOICES, default=VISIBILITY_FRIENDS)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)


class StatusView(models.Model):
    status = models.ForeignKey(Status, related_name='views', on_delete=models.CASCADE)
    viewer = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='status_views', on_delete=models.CASCADE)
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('status', 'viewer')

    def __str__(self):
        return f'{self.viewer} viewed {self.status_id}'


class Report(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_RESOLVED = 'resolved'
    STATUS_DISMISSED = 'dismissed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'En attente'),
        (STATUS_RESOLVED, 'Traité'),
        (STATUS_DISMISSED, 'Rejeté'),
    ]

    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='reports_made', on_delete=models.CASCADE)
    reported_user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='reports_received', on_delete=models.CASCADE)
    reason = models.CharField(max_length=255)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.reporter} -> {self.reported_user} ({self.status})'


class Announcement(models.Model):
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='announcements')
    group = models.ForeignKey('Group', on_delete=models.CASCADE, null=True, blank=True, related_name='announcements')
    title = models.CharField(max_length=200)
    content = models.TextField()
    is_urgent = models.BooleanField(default=False)
    file = models.FileField(upload_to='announcement_files/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Event(models.Model):
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='events')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date = models.DateTimeField()
    location = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date']

    def __str__(self):
        return self.title


class TimetableEntry(models.Model):
    DAY_CHOICES = [
        ('lundi', 'Lundi'),
        ('mardi', 'Mardi'),
        ('mercredi', 'Mercredi'),
        ('jeudi', 'Jeudi'),
        ('vendredi', 'Vendredi'),
        ('samedi', 'Samedi'),
        ('dimanche', 'Dimanche'),
    ]

    filiere = models.CharField(max_length=100)
    niveau = models.CharField(max_length=20)
    day = models.CharField(max_length=10, choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    subject = models.CharField(max_length=150)
    room = models.CharField(max_length=100, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='timetable_entries')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_time']

    def __str__(self):
        return f'{self.subject} ({self.filiere} {self.niveau}, {self.day})'


class Group(models.Model):
    KIND_CYCLE_LICENCE = 'cycle_licence'
    KIND_CYCLE_MASTER = 'cycle_master'
    KIND_NIVEAU_ANNONCES = 'niveau_annonces'
    KIND_NIVEAU_DISCUSSION = 'niveau_discussion'
    KIND_CLUB = 'club'
    KIND_PROJET = 'projet'

    SYSTEM_KINDS = (KIND_CYCLE_LICENCE, KIND_CYCLE_MASTER, KIND_NIVEAU_ANNONCES, KIND_NIVEAU_DISCUSSION)

    KIND_CHOICES = [
        (KIND_CYCLE_LICENCE, 'Cycle Licence'),
        (KIND_CYCLE_MASTER, 'Cycle Master'),
        (KIND_NIVEAU_ANNONCES, 'Annonces de niveau'),
        (KIND_NIVEAU_DISCUSSION, 'Discussion de niveau'),
        (KIND_CLUB, 'Club / Association'),
        (KIND_PROJET, 'Groupe de projet'),
    ]

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=KIND_CLUB)
    filiere = models.CharField(max_length=100, blank=True)
    niveau = models.CharField(max_length=20, blank=True)
    is_system = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_groups',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['kind', 'filiere', 'niveau'],
                condition=models.Q(is_system=True),
                name='unique_system_group',
            ),
        ]

    def __str__(self):
        return self.name


class GroupMembership(models.Model):
    ROLE_MEMBER = 'member'
    ROLE_ADMIN = 'admin'
    ROLE_CHOICES = [
        (ROLE_MEMBER, 'Membre'),
        (ROLE_ADMIN, 'Admin'),
    ]

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='group_memberships')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=ROLE_MEMBER)
    leave_requested = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('group', 'user')


class Poll(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='polls')
    question = models.CharField(max_length=300)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='polls_created')
    created_at = models.DateTimeField(auto_now_add=True)
    closed = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']


class PollOption(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=150)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']


class PollVote(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='votes')
    option = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name='votes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='poll_votes')
    voted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('poll', 'user')


class Notification(models.Model):
    TYPE_FRIEND_REQUEST = 'friend_request'
    TYPE_FRIEND_ACCEPTED = 'friend_accepted'
    TYPE_MESSAGE = 'message'
    TYPE_STATUS = 'status'
    TYPE_ANNOUNCEMENT = 'announcement'
    TYPE_LEAVE_REQUEST = 'leave_request'

    TYPE_CHOICES = [
        (TYPE_FRIEND_REQUEST, "Demande d'amitié"),
        (TYPE_FRIEND_ACCEPTED, 'Amitié acceptée'),
        (TYPE_MESSAGE, 'Message'),
        (TYPE_STATUS, 'Statut'),
        (TYPE_ANNOUNCEMENT, 'Annonce'),
        (TYPE_LEAVE_REQUEST, 'Demande de départ'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='notifications', on_delete=models.CASCADE)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    message = models.CharField(max_length=255)
    related_id = models.IntegerField(null=True, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class PushSubscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint = models.URLField(max_length=500)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'endpoint')
