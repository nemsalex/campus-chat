from pathlib import Path

from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.http import FileResponse, Http404
from django.urls import path, include, re_path
from chat import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/stats/', views.admin_stats),
    path('api/create-room/', views.create_room),
    path('api/chat/', include('chat.urls')),
    path('api/auth/', include('accounts.urls')),
    path('api/social/', include('social.urls')),
]

# Media is served by Django itself (fine at this project's scale — no object
# storage is set up yet). Always on, not just DEBUG, since there's no separate
# media host in production.
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


def spa_index(request, *args, **kwargs):
    index_path = Path(settings.FRONTEND_DIST) / 'index.html'
    if not index_path.exists():
        raise Http404
    return FileResponse(open(index_path, 'rb'))


# Anything else falls through to the built React app, so client-side routes
# (e.g. /messages, /campus/groupes/3) resolve correctly on a full page load.
urlpatterns += [
    re_path(r'^(?!api/|admin/|media/|static/).*$', spa_index, name='spa'),
]
