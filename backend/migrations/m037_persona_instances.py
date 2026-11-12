"""M037 Phase N1-M2：人格定义 / 版本 / 实例表与隔离索引。

新表由 `models.Base.metadata.create_all` 在迁移前建立；本迁移只补索引与版本记录。
云宝实例的引导与旧线程/记忆绑定由 `yunbao.ensure_yunbao` 幂等完成，避免迁移脚本写业务数据。
"""

from .util import create_index, table_exists

VERSION = "M037"


def apply(conn):
    if table_exists(conn, "persona_definitions"):
        create_index(
            conn, "ix_persona_definitions_owner_scope",
            "persona_definitions", "owner_user_id, scope",
        )
        create_index(conn, "ix_persona_definitions_legacy", "persona_definitions", "legacy_persona_id")

    if table_exists(conn, "persona_versions"):
        create_index(conn, "ix_persona_versions_definition", "persona_versions", "definition_id")

    if table_exists(conn, "persona_instances"):
        create_index(conn, "ix_persona_instances_owner_kind", "persona_instances", "owner_user_id, kind")
        create_index(conn, "ix_persona_instances_definition", "persona_instances", "definition_id")
        create_index(conn, "ix_persona_instances_version", "persona_instances", "version_id")
