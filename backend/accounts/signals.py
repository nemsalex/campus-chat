from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import User


def cycle_for_niveau(niveau):
    niveau = (niveau or '').strip().upper()
    if niveau.startswith('L'):
        return 'licence'
    if niveau.startswith('M'):
        return 'master'
    return None


@receiver(post_save, sender=User)
def assign_system_groups(sender, instance, created, **kwargs):
    if not created or instance.role != User.ROLE_STUDENT:
        return
    if not instance.filiere or not instance.niveau:
        return

    from social.models import Group, GroupMembership

    cycle = cycle_for_niveau(instance.niveau)
    if cycle == 'licence':
        cycle_group, _ = Group.objects.get_or_create(
            kind=Group.KIND_CYCLE_LICENCE, filiere=instance.filiere, niveau='',
            defaults={'name': f'{instance.filiere} (Licence)', 'is_system': True},
        )
        GroupMembership.objects.get_or_create(group=cycle_group, user=instance)
    elif cycle == 'master':
        cycle_group, _ = Group.objects.get_or_create(
            kind=Group.KIND_CYCLE_MASTER, filiere=instance.filiere, niveau='',
            defaults={'name': f'{instance.filiere} (Master)', 'is_system': True},
        )
        GroupMembership.objects.get_or_create(group=cycle_group, user=instance)

    annonces_group, _ = Group.objects.get_or_create(
        kind=Group.KIND_NIVEAU_ANNONCES, filiere=instance.filiere, niveau=instance.niveau,
        defaults={'name': f'{instance.niveau} {instance.filiere} — Annonces', 'is_system': True},
    )
    GroupMembership.objects.get_or_create(group=annonces_group, user=instance)

    discussion_group, _ = Group.objects.get_or_create(
        kind=Group.KIND_NIVEAU_DISCUSSION, filiere=instance.filiere, niveau=instance.niveau,
        defaults={'name': f'{instance.niveau} {instance.filiere} — Discussion', 'is_system': True},
    )
    GroupMembership.objects.get_or_create(group=discussion_group, user=instance)
