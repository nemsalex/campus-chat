from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from chat import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/stats/', views.admin_stats),
    path('api/create-room/', views.create_room),
    path('api/chat/', include('chat.urls')),
    path('api/auth/', include('accounts.urls')),
    path('api/social/', include('social.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
