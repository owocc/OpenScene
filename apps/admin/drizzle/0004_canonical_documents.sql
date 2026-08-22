-- Upgrade every persisted document to the Protocol canonical wrapper and flat spec.
-- Malformed or empty specs receive the deterministic empty document shape.
WITH normalized(id, elements) AS (
  SELECT d.id,
    json_group_object(
      e.key,
      json_set(e.value, '$.props', COALESCE(json_extract(e.value, '$.props'), json('{}')))
    )
  FROM documents d, json_each(json_extract(d.draft_json, '$.spec.elements')) e
  WHERE json_valid(d.draft_json)
    AND json_type(d.draft_json, '$.spec.root') = 'text'
    AND json_type(d.draft_json, '$.spec.elements') = 'object'
  GROUP BY d.id
)
UPDATE documents
SET draft_json = CASE
  WHEN id IN (SELECT id FROM normalized)
  THEN json_set(
    json_set(
      json_set(json(draft_json), '$.schemaVersion', '1.0.0'),
      '$.pageInfo',
      CASE WHEN json_type(draft_json, '$.pageInfo') = 'object'
        THEN json_patch(json_object('title', '', 'description', '', 'keywords', json('[]'), 'locale', 'en-US', 'metadata', json('{}')), json_extract(draft_json, '$.pageInfo'))
        ELSE json_object('title', '', 'description', '', 'keywords', json('[]'), 'locale', 'en-US', 'metadata', json('{}'))
      END
    ),
    '$.globalConfig', CASE WHEN json_type(draft_json, '$.globalConfig') = 'object' THEN json_extract(draft_json, '$.globalConfig') ELSE json('{}') END
  )
  ELSE json_object(
    'schemaVersion', '1.0.0',
    'pageInfo', json_object('title', '', 'description', '', 'keywords', json('[]'), 'locale', 'en-US', 'metadata', json('{}')),
    'globalConfig', json('{}'),
    'spec', json_object('root', 'root', 'elements', json_object('root', json_object('type', 'View', 'props', json('{}'), 'children', json('[]'))), 'state', json('{}'))
  )
END;

WITH normalized(id, elements) AS (
  SELECT d.id,
    json_group_object(
      e.key,
      json_set(e.value, '$.props', COALESCE(json_extract(e.value, '$.props'), json('{}')))
    )
  FROM documents d, json_each(json_extract(d.draft_json, '$.spec.elements')) e
  WHERE json_valid(d.draft_json)
    AND json_type(d.draft_json, '$.spec.root') = 'text'
    AND json_type(d.draft_json, '$.spec.elements') = 'object'
  GROUP BY d.id
)
UPDATE documents
SET draft_json = json_set(draft_json, '$.spec.elements', json((SELECT elements FROM normalized WHERE normalized.id = documents.id)))
WHERE id IN (SELECT id FROM normalized);

WITH normalized(id, elements) AS (
  SELECT v.id,
    json_group_object(
      e.key,
      json_set(e.value, '$.props', COALESCE(json_extract(e.value, '$.props'), json('{}')))
    )
  FROM document_versions v, json_each(json_extract(v.document_json, '$.spec.elements')) e
  WHERE json_valid(v.document_json)
    AND json_type(v.document_json, '$.spec.root') = 'text'
    AND json_type(v.document_json, '$.spec.elements') = 'object'
  GROUP BY v.id
)
UPDATE document_versions
SET document_json = CASE
  WHEN id IN (SELECT id FROM normalized)
  THEN json_set(
    json_set(
      json_set(json(document_json), '$.schemaVersion', '1.0.0'),
      '$.pageInfo',
      CASE WHEN json_type(document_json, '$.pageInfo') = 'object'
        THEN json_patch(json_object('title', '', 'description', '', 'keywords', json('[]'), 'locale', 'en-US', 'metadata', json('{}')),
          json_extract(document_json, '$.pageInfo'))
        ELSE json_object('title', '', 'description', '', 'keywords', json('[]'), 'locale', 'en-US', 'metadata', json('{}'))
      END
    ),
    '$.globalConfig', CASE WHEN json_type(document_json, '$.globalConfig') = 'object' THEN json_extract(document_json, '$.globalConfig') ELSE json('{}') END
  )
  ELSE json_object(
    'schemaVersion', '1.0.0',
    'pageInfo', json_object('title', '', 'description', '', 'keywords', json('[]'), 'locale', 'en-US', 'metadata', json('{}')),
    'globalConfig', json('{}'),
    'spec', json_object('root', 'root', 'elements', json_object('root', json_object('type', 'View', 'props', json('{}'), 'children', json('[]'))), 'state', json('{}'))
  )
END;

WITH normalized(id, elements) AS (
  SELECT v.id,
    json_group_object(
      e.key,
      json_set(e.value, '$.props', COALESCE(json_extract(e.value, '$.props'), json('{}')))
    )
  FROM document_versions v, json_each(json_extract(v.document_json, '$.spec.elements')) e
  WHERE json_valid(v.document_json)
    AND json_type(v.document_json, '$.spec.root') = 'text'
    AND json_type(v.document_json, '$.spec.elements') = 'object'
  GROUP BY v.id
)
UPDATE document_versions
SET document_json = json_set(document_json, '$.spec.elements', json((SELECT elements FROM normalized WHERE normalized.id = document_versions.id)))
WHERE id IN (SELECT id FROM normalized);
