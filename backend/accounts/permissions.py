from rest_framework.permissions import BasePermission
from .models import User

STAFF_ROLES = (User.ROLE_TEACHER, User.ROLE_ADMIN_STAFF, User.ROLE_MAIN_ADMIN)


class IsStaffRole(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.role in STAFF_ROLES or u.is_creator))


class IsMainAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.role == User.ROLE_MAIN_ADMIN or u.is_creator))


class IsCreator(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_creator)
