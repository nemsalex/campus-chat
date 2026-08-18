from django.contrib import admin
from .models import Friendship, Status, Announcement, Event, Notification, Group, GroupMembership

admin.site.register(Friendship)
admin.site.register(Status)
admin.site.register(Announcement)
admin.site.register(Event)
admin.site.register(Notification)
admin.site.register(Group)
admin.site.register(GroupMembership)
