from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import UserList, UserListItem
from .serializers import UserListSerializer, UserListItemSerializer


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def lists_list(request):
    if request.method == "GET":
        user_lists = UserList.objects.filter(user=request.user).prefetch_related("items").order_by("-created_at")
        return Response(UserListSerializer(user_lists, many=True).data)

    serializer = UserListSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user_list = UserList.objects.create(
        user=request.user,
        name=serializer.validated_data["name"],
        description=serializer.validated_data.get("description", ""),
    )
    return Response(UserListSerializer(user_list).data, status=status.HTTP_201_CREATED)


@api_view(["DELETE", "PATCH"])
@permission_classes([IsAuthenticated])
def lists_detail(request, pk):
    user_list = get_object_or_404(UserList, pk=pk, user=request.user)
    if request.method == "PATCH":
        serializer = UserListSerializer(instance=user_list, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    user_list.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def list_items_create(request, list_pk):
    user_list = get_object_or_404(UserList, pk=list_pk, user=request.user)
    serializer = UserListItemSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    item, created = UserListItem.objects.get_or_create(
        user_list=user_list,
        media_id=serializer.validated_data["media_id"],
        media_type=serializer.validated_data["media_type"],
        defaults={
            "title": serializer.validated_data["title"],
            "poster_path": serializer.validated_data.get("poster_path"),
            "vote_average": serializer.validated_data.get("vote_average", 0),
        },
    )
    return Response(
        UserListItemSerializer(item).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def list_items_clear(request, list_pk):
    user_list = get_object_or_404(UserList, pk=list_pk, user=request.user)
    user_list.items.all().delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def list_items_detail(request, list_pk, item_pk):
    user_list = get_object_or_404(UserList, pk=list_pk, user=request.user)
    item = get_object_or_404(UserListItem, pk=item_pk, user_list=user_list)
    item.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
