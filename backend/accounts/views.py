from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User
from .permissions import IsCreator, IsMainAdmin
from .serializers import RegisterSerializer, UserSerializer, PrivacySettingsSerializer, ChangePasswordSerializer


def tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        if not user.is_active:
            return Response({
                'pending': True,
                'detail': "Compte créé. Il sera activé après validation par l'administration.",
            }, status=http_status.HTTP_201_CREATED)

        return Response({
            **tokens_for_user(user),
            'user': UserSerializer(user).data,
        }, status=http_status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifiant = (request.data.get('identifiant') or request.data.get('matricule') or '').strip()
        password = request.data.get('password', '')

        user = None
        if identifiant:
            user = User.objects.filter(Q(matricule=identifiant) | Q(email__iexact=identifiant)).first()
        if not user or not user.check_password(password):
            return Response({'detail': 'Identifiant ou mot de passe incorrect.'}, status=http_status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response(
                {'detail': "Ton compte est en attente de validation par l'administration."},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        return Response({
            **tokens_for_user(user),
            'user': UserSerializer(user).data,
        })


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class PrivacyView(generics.RetrieveUpdateAPIView):
    serializer_class = PrivacySettingsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not request.user.check_password(serializer.validated_data['old_password']):
            return Response({'detail': 'Mot de passe actuel incorrect.'}, status=http_status.HTTP_400_BAD_REQUEST)

        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'detail': 'Mot de passe mis à jour.'})


class PendingStaffListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsMainAdmin]

    def get_queryset(self):
        return User.objects.filter(
            is_active=False, role__in=(User.ROLE_TEACHER, User.ROLE_ADMIN_STAFF),
        ).order_by('date_joined')


class ApproveStaffView(APIView):
    permission_classes = [IsMainAdmin]

    def post(self, request, pk):
        User.objects.filter(pk=pk, is_active=False).update(is_active=True)
        return Response({'detail': 'Compte validé.'})


class RejectStaffView(APIView):
    permission_classes = [IsMainAdmin]

    def post(self, request, pk):
        User.objects.filter(pk=pk, is_active=False).delete()
        return Response({'detail': 'Compte refusé.'})


class AdminStatsView(APIView):
    permission_classes = [IsMainAdmin]

    def get(self, request):
        return Response({
            'students': User.objects.filter(role=User.ROLE_STUDENT, is_active=True).count(),
            'teachers': User.objects.filter(role=User.ROLE_TEACHER, is_active=True).count(),
            'admin_staff': User.objects.filter(role=User.ROLE_ADMIN_STAFF, is_active=True).count(),
            'pending': User.objects.filter(is_active=False, role__in=(User.ROLE_TEACHER, User.ROLE_ADMIN_STAFF)).count(),
        })


class CreatorConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = (request.data.get('token') or '').strip()
        if not token:
            return Response({'detail': 'Token manquant.'}, status=http_status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(creator_token=token).exclude(creator_token='').first()
        if not user:
            return Response({'detail': 'Lien invalide ou déjà utilisé.'}, status=http_status.HTTP_404_NOT_FOUND)
        user.is_creator = True
        user.is_active = True
        user.creator_token = ''
        user.save(update_fields=['is_creator', 'is_active', 'creator_token'])
        return Response({'detail': 'Statut créateur confirmé. Tu peux te connecter.'})


class CreatorOverviewView(APIView):
    permission_classes = [IsCreator]

    def get(self, request):
        from chat.models import Message
        return Response({
            'total_users': User.objects.count(),
            'users_by_role': {
                'etudiant': User.objects.filter(role=User.ROLE_STUDENT).count(),
                'professeur': User.objects.filter(role=User.ROLE_TEACHER).count(),
                'administration': User.objects.filter(role=User.ROLE_ADMIN_STAFF).count(),
                'admin_principal': User.objects.filter(role=User.ROLE_MAIN_ADMIN).count(),
            },
            'total_messages': Message.objects.count(),
        })


class CreatorUsersListView(APIView):
    permission_classes = [IsCreator]

    def get(self, request):
        from chat.models import Message
        message_counts = dict(Message.objects.order_by().values_list('username').annotate(count=Count('id')))
        users = User.objects.all().order_by('-date_joined')
        return Response([
            {
                'id': u.id,
                'matricule': u.matricule,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'email': u.email,
                'role': u.role,
                'filiere': u.filiere,
                'niveau': u.niveau,
                'is_active': u.is_active,
                'is_creator': u.is_creator,
                'date_joined': u.date_joined,
                'message_count': message_counts.get(u.matricule, 0),
            }
            for u in users
        ])


class CreatorAdminsListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsCreator]

    def get_queryset(self):
        return User.objects.filter(role=User.ROLE_MAIN_ADMIN).order_by('first_name')


class CreatorTeachersListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsCreator]

    def get_queryset(self):
        return User.objects.filter(role=User.ROLE_TEACHER).order_by('first_name')


class CreatorPromoteAdminView(APIView):
    permission_classes = [IsCreator]

    def post(self, request):
        target = get_object_or_404(User, pk=request.data.get('user_id'))
        if target.is_creator or target.role == User.ROLE_MAIN_ADMIN:
            return Response({'detail': 'Action impossible sur ce compte.'}, status=http_status.HTTP_400_BAD_REQUEST)
        target.role = User.ROLE_MAIN_ADMIN
        target.is_active = True
        target.save(update_fields=['role', 'is_active'])
        return Response({'detail': f'{target.first_name} {target.last_name} est maintenant admin principal.'})


class CreatorDemoteAdminView(APIView):
    permission_classes = [IsCreator]

    def post(self, request):
        target = get_object_or_404(User, pk=request.data.get('user_id'), role=User.ROLE_MAIN_ADMIN)
        target.role = User.ROLE_STUDENT
        target.save(update_fields=['role'])
        return Response({'detail': f'{target.first_name} {target.last_name} n\'est plus admin principal.'})


class SuspendUserView(APIView):
    permission_classes = [IsMainAdmin]

    def post(self, request, pk):
        target = get_object_or_404(User, pk=pk)
        if target.is_creator:
            return Response({'detail': 'Action impossible sur ce compte.'}, status=http_status.HTTP_400_BAD_REQUEST)
        target.is_active = False
        target.save(update_fields=['is_active'])
        from chat.consumers import disconnect_user
        disconnect_user(target.matricule)
        return Response({'detail': f'{target.first_name} {target.last_name} suspendu.'})


class ReactivateUserView(APIView):
    permission_classes = [IsMainAdmin]

    def post(self, request, pk):
        target = get_object_or_404(User, pk=pk)
        target.is_active = True
        target.save(update_fields=['is_active'])
        return Response({'detail': f'{target.first_name} {target.last_name} réactivé.'})


class CreatorOnlineUsersView(APIView):
    permission_classes = [IsCreator]

    def get(self, request):
        from chat.consumers import connected_users
        matricules = list(connected_users.keys())
        users = User.objects.filter(matricule__in=matricules)
        return Response([
            {'matricule': u.matricule, 'first_name': u.first_name, 'last_name': u.last_name, 'role': u.role}
            for u in users
        ])
