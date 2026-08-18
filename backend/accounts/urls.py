from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view()),
    path('login/', views.LoginView.as_view()),
    path('me/', views.MeView.as_view()),
    path('privacy/', views.PrivacyView.as_view()),
    path('change-password/', views.ChangePasswordView.as_view()),
    path('pending/', views.PendingStaffListView.as_view()),
    path('pending/<int:pk>/approve/', views.ApproveStaffView.as_view()),
    path('pending/<int:pk>/reject/', views.RejectStaffView.as_view()),
    path('admin-stats/', views.AdminStatsView.as_view()),

    path('creator/confirm/', views.CreatorConfirmView.as_view()),
    path('creator/overview/', views.CreatorOverviewView.as_view()),
    path('creator/users/', views.CreatorUsersListView.as_view()),
    path('creator/admins/', views.CreatorAdminsListView.as_view()),
    path('creator/teachers/', views.CreatorTeachersListView.as_view()),
    path('creator/promote-admin/', views.CreatorPromoteAdminView.as_view()),
    path('creator/demote-admin/', views.CreatorDemoteAdminView.as_view()),
    path('creator/online/', views.CreatorOnlineUsersView.as_view()),

    path('suspend/<int:pk>/', views.SuspendUserView.as_view()),
    path('reactivate/<int:pk>/', views.ReactivateUserView.as_view()),

    path('token/refresh/', TokenRefreshView.as_view()),
]
