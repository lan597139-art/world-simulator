"""M040 Phase N1-M5：社区公开作品、版本、评论、收藏。"""

from .util import create_index, table_exists

VERSION = "M040"


def apply(conn):
    for table, indexes in {
        "community_publications": [
            ("ix_community_publications_status_time", "status, published_at"),
            ("ix_community_publications_owner", "owner_user_id, status"),
            ("ix_community_publications_public", "public_id"),
        ],
        "community_publication_versions": [
            ("ix_community_publication_versions_pub", "publication_id, version_no"),
        ],
        "community_comments": [
            ("ix_community_comments_pub_time", "publication_id, created_at"),
        ],
        "community_favorites": [
            ("ix_community_favorites_pub", "publication_id"),
            ("ix_community_favorites_owner", "owner_user_id"),
        ],
    }.items():
        if table_exists(conn, table):
            for name, columns in indexes:
                create_index(conn, name, table, columns)
