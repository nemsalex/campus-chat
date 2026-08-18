from rest_framework import serializers
from .models import User


class RelativeImageField(serializers.ImageField):
    """Always serializes to a relative /media/... path, never an absolute URL.

    DRF's default FileField/ImageField returns an absolute URL when the
    serializer context happens to include the request (which DRF's generic
    views add automatically) and a relative path otherwise. That
    inconsistency broke image/file rendering on the frontend, which always
    prefixes the value with its own API base URL.
    """

    def to_representation(self, value):
        if not value:
            return None
        try:
            return value.url
        except AttributeError:
            return None


class RelativeFileField(serializers.FileField):
    def to_representation(self, value):
        if not value:
            return None
        try:
            return value.url
        except AttributeError:
            return None


class UserSerializer(serializers.ModelSerializer):
    photo = RelativeImageField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ['id', 'matricule', 'email', 'first_name', 'last_name', 'role', 'filiere', 'niveau', 'photo', 'is_creator']
        read_only_fields = ['matricule', 'role', 'is_creator']


class PrivacySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['who_can_friend_request', 'who_can_message', 'show_online_status']


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(min_length=6)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    matricule = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    role = serializers.ChoiceField(
        choices=[
            (User.ROLE_STUDENT, 'Étudiant'),
            (User.ROLE_TEACHER, 'Professeur'),
            (User.ROLE_ADMIN_STAFF, 'Administration'),
        ],
        default=User.ROLE_STUDENT,
    )

    class Meta:
        model = User
        fields = ['matricule', 'email', 'first_name', 'last_name', 'password', 'role', 'filiere', 'niveau']
        validators = []

    def validate(self, data):
        role = data.get('role', User.ROLE_STUDENT)
        if role == User.ROLE_TEACHER:
            email = data.get('email', '').strip()
            if not email:
                raise serializers.ValidationError({'email': 'Email requis pour les professeurs.'})
            if User.objects.filter(email__iexact=email).exists():
                raise serializers.ValidationError({'email': 'Cet email est déjà utilisé.'})
        else:
            matricule = data.get('matricule', '').strip()
            if not matricule:
                raise serializers.ValidationError({'matricule': 'Matricule requis.'})
            if User.objects.filter(matricule=matricule).exists():
                raise serializers.ValidationError({'matricule': 'Ce matricule est déjà utilisé.'})
        return data

    def create(self, validated_data):
        password = validated_data.pop('password')
        role = validated_data.get('role', User.ROLE_STUDENT)
        is_active = role == User.ROLE_STUDENT

        matricule = validated_data.get('matricule', '').strip()
        if role == User.ROLE_TEACHER and not matricule:
            matricule = self._generate_teacher_matricule()
        validated_data['matricule'] = matricule
        validated_data['email'] = validated_data.get('email', '').strip()

        user = User(
            username=matricule,
            is_active=is_active,
            **validated_data,
        )
        user.set_password(password)
        user.save()
        return user

    @staticmethod
    def _generate_teacher_matricule():
        import uuid
        while True:
            candidate = f'PROF-{uuid.uuid4().hex[:8].upper()}'
            if not User.objects.filter(matricule=candidate).exists():
                return candidate
