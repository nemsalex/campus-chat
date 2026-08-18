import json
import logging

from django.conf import settings
from pywebpush import WebPushException, webpush

logger = logging.getLogger(__name__)

TITLES = {
    'friend_request': "Nouvelle demande d'ami",
    'friend_accepted': 'Demande acceptée',
    'message': 'Nouveau message',
    'status': 'Nouveau statut',
    'announcement': 'Nouvelle annonce',
    'leave_request': 'Demande de départ',
}


def _url_for(type_, related_id):
    if type_ == 'friend_request':
        return '/demandes'
    if type_ == 'friend_accepted':
        return '/amis'
    if type_ == 'status':
        return '/'
    if type_ == 'leave_request':
        return f'/campus/groupes/{related_id}/infos' if related_id else '/campus'
    if type_ == 'announcement':
        return f'/annonces/{related_id}' if related_id else '/'
    return '/notifications'


def send_push_to_user(user, type_, body, related_id=None, url=None):
    from .models import PushSubscription

    if not getattr(settings, 'VAPID_PRIVATE_KEY', None):
        return
    subscriptions = list(PushSubscription.objects.filter(user=user))
    if not subscriptions:
        return

    payload = json.dumps({
        'title': TITLES.get(type_, 'Campus Chat'),
        'body': body,
        'url': url or _url_for(type_, related_id),
    })

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    'endpoint': sub.endpoint,
                    'keys': {'p256dh': sub.p256dh, 'auth': sub.auth},
                },
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={'sub': settings.VAPID_CLAIM_EMAIL},
            )
        except WebPushException as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (404, 410):
                sub.delete()
            else:
                logger.warning('Push failed for %s: %s', user.matricule, exc)
        except Exception:
            logger.exception('Unexpected push delivery error for %s', user.matricule)
