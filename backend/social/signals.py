from django.db.models.signals import post_save
from django.dispatch import receiver

from accounts.models import User
from .models import Announcement, Notification


@receiver(post_save, sender=Announcement)
def notify_announcement(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.group_id:
        recipients = User.objects.filter(group_memberships__group_id=instance.group_id).exclude(id=instance.author_id)
    else:
        recipients = User.objects.filter(is_active=True)
    Notification.objects.bulk_create([
        Notification(user=u, type=Notification.TYPE_ANNOUNCEMENT, message=instance.title, related_id=instance.id)
        for u in recipients
    ])
