from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_STUDENT = 'etudiant'
    ROLE_TEACHER = 'professeur'
    ROLE_ADMIN_STAFF = 'administration'
    ROLE_MAIN_ADMIN = 'admin_principal'

    ROLE_CHOICES = [
        (ROLE_STUDENT, 'Étudiant'),
        (ROLE_TEACHER, 'Professeur'),
        (ROLE_ADMIN_STAFF, 'Administration'),
        (ROLE_MAIN_ADMIN, 'Admin principal'),
    ]

    VISIBILITY_EVERYONE = 'everyone'
    VISIBILITY_FRIENDS = 'friends'
    VISIBILITY_NOBODY = 'nobody'

    FRIEND_REQUEST_CHOICES = [
        (VISIBILITY_EVERYONE, 'Tout le campus'),
        (VISIBILITY_NOBODY, 'Personne'),
    ]
    MESSAGE_CHOICES = [
        (VISIBILITY_EVERYONE, 'Tout le campus'),
        (VISIBILITY_FRIENDS, 'Mes amis'),
        (VISIBILITY_NOBODY, 'Personne'),
    ]
    ONLINE_STATUS_CHOICES = [
        (VISIBILITY_EVERYONE, 'Tout le campus'),
        (VISIBILITY_FRIENDS, 'Mes amis'),
        (VISIBILITY_NOBODY, 'Personne'),
    ]

    matricule = models.CharField(max_length=30, unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_STUDENT)
    filiere = models.CharField(max_length=100, blank=True)
    niveau = models.CharField(max_length=20, blank=True)
    photo = models.ImageField(upload_to='profile_photos/', blank=True, null=True)

    is_creator = models.BooleanField(default=False)
    creator_token = models.CharField(max_length=64, blank=True)

    who_can_friend_request = models.CharField(max_length=10, choices=FRIEND_REQUEST_CHOICES, default=VISIBILITY_EVERYONE)
    who_can_message = models.CharField(max_length=10, choices=MESSAGE_CHOICES, default=VISIBILITY_FRIENDS)
    show_online_status = models.CharField(max_length=10, choices=ONLINE_STATUS_CHOICES, default=VISIBILITY_FRIENDS)

    def __str__(self):
        return f'{self.matricule} ({self.get_role_display()})'
