from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ['matricule', 'first_name', 'last_name', 'role', 'is_active', 'date_joined']
    list_filter = ['role', 'is_active']
    search_fields = ['matricule', 'first_name', 'last_name']
    fieldsets = DjangoUserAdmin.fieldsets + (
        ('Campus', {'fields': ('matricule', 'role', 'filiere', 'niveau', 'photo')}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ('Campus', {'fields': ('matricule', 'role', 'filiere', 'niveau')}),
    )
