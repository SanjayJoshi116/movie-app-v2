from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    page_size = 100
    # The library loads (watched/watchlist/ratings) ask for 500 per page, so a
    # large history takes a few requests instead of one per 100 rows.
    page_size_query_param = "page_size"
    max_page_size = 500

    def get_next_link(self):
        if not self.page.has_next():
            return None
        return self.page.next_page_number()

    def get_previous_link(self):
        if not self.page.has_previous():
            return None
        return self.page.previous_page_number()
