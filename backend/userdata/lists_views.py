from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .bulk_import import bulk_import, timestamp_or_now
from .models import UserList, UserListItem
from .pagination import DefaultPagination
from .serializers import BulkWatchlistEntrySerializer, UserListSerializer, UserListItemSerializer


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def lists_list(request):
    if request.method == "GET":
        user_lists = UserList.objects.filter(user=request.user).prefetch_related("items").order_by("-created_at", "-id")
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(user_lists, request)
        return paginator.get_paginated_response(UserListSerializer(page, many=True).data)

    serializer = UserListSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user_list = UserList.objects.create(
        user=request.user,
        name=serializer.validated_data["name"],
        description=serializer.validated_data.get("description", ""),
        created_at=timestamp_or_now(serializer.validated_data.get("created_at")),
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


def _not_found_if_list_gone(request, list_pk, error):
    """An item insert failed its list FK: the list was deleted mid-request.
    That's a 404; any other integrity error is a real bug and re-raises."""
    if UserList.objects.filter(pk=list_pk, user=request.user).exists():
        raise error
    return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def list_items_create(request, list_pk):
    user_list = get_object_or_404(UserList, pk=list_pk, user=request.user)
    serializer = UserListItemSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
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
    except IntegrityError as error:
        return _not_found_if_list_gone(request, list_pk, error)
    return Response(
        UserListItemSerializer(item).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def list_items_bulk(request, list_pk):
    """Bulk-add items to one list (backup restore, CSV list import). Same rules
    as the other bulk endpoints; an entry's `addedAt` is kept, so a restored
    list keeps its dates and order."""
    user_list = get_object_or_404(UserList, pk=list_pk, user=request.user)

    def build(user, media_type, item):
        vote_average = item.get("voteAverage")
        return UserListItem(
            user_list=user_list,
            media_id=item["mediaId"],
            media_type=media_type,
            title=item["title"],
            poster_path=item.get("posterPath"),
            vote_average=0 if vote_average is None else vote_average,
            added_at=timestamp_or_now(item.get("addedAt")),
        )

    # A list item's entry is a watchlist entry's: media identity, title,
    # poster, vote and an optional addedAt.
    try:
        return bulk_import(
            request,
            model=UserListItem,
            entry_serializer=BulkWatchlistEntrySerializer,
            build=build,
            scope={"user_list": user_list},
        )
    except IntegrityError as error:
        # The list FK is deferred, so this surfaces at bulk_import's commit.
        return _not_found_if_list_gone(request, list_pk, error)


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
