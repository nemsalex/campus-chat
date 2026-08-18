from django.conf import settings
from django.db import models


class Conversation(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_ACCEPTED = 'accepted'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'En attente'),
        (STATUS_ACCEPTED, 'Acceptée'),
    ]

    user_a = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='conversations_as_a', on_delete=models.CASCADE)
    user_b = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='conversations_as_b', on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_ACCEPTED)
    initiated_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='conversations_initiated', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user_a', 'user_b')

    @staticmethod
    def between(u1, u2):
        return sorted([u1, u2], key=lambda u: u.id)

    def __str__(self):
        return f'{self.user_a.matricule} <-> {self.user_b.matricule} ({self.status})'


class Room(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Message(models.Model):
    username = models.CharField(max_length=100)
    content = models.TextField(blank=True)
    room = models.CharField(max_length=100, default='general')
    file_url = models.CharField(max_length=500, blank=True)
    file_name = models.CharField(max_length=255, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)
    edited = models.BooleanField(default=False)
    deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f'{self.username} [{self.room}]: {self.content[:50]}'


class MessageReaction(models.Model):
    message = models.ForeignKey(Message, related_name='reactions', on_delete=models.CASCADE)
    username = models.CharField(max_length=100)
    emoji = models.CharField(max_length=8)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('message', 'username')