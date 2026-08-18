from django.urls import path
from . import views

urlpatterns = [
    path('conversations/', views.ConversationsListView.as_view()),
    path('conversations/<str:matricule>/messages/', views.ConversationMessagesView.as_view()),
    path('conversations/<str:matricule>/mark-read/', views.ConversationMarkReadView.as_view()),
    path('conversations/<str:matricule>/status/', views.ConversationStatusView.as_view()),
    path('conversations/<str:matricule>/accept/', views.ConversationAcceptView.as_view()),
    path('conversations/<str:matricule>/decline/', views.ConversationDeclineView.as_view()),
    path('requests/', views.MessageRequestsListView.as_view()),
    path('upload/', views.ChatFileUploadView.as_view()),

    path('creator/conversations/', views.CreatorConversationsView.as_view()),
    path('creator/users/<str:matricule>/conversations/', views.CreatorUserConversationsView.as_view()),
    path('creator/rooms/<str:room>/messages/', views.CreatorRoomMessagesView.as_view()),
    path('creator/messages/<int:message_id>/delete/', views.CreatorDeleteMessageView.as_view()),
]
