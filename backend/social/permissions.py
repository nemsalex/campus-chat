from rest_framework.permissions import BasePermission
from .models import GroupMembership


class IsGroupAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        group_id = view.kwargs.get('pk')
        return GroupMembership.objects.filter(
            group_id=group_id, user=request.user, role=GroupMembership.ROLE_ADMIN,
        ).exists()
