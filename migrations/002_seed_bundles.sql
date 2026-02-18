INSERT INTO bundles (title, description, price, metadata_url) VALUES
(
    'Bach Cello Suite No. 1 in G Major',
    'Complete transcription of J.S. Bach''s beloved Cello Suite No. 1 including PDF score, MusicXML source, and structured JSON analysis.',
    9.99,
    'bundles/bach-cello-suite-1/metadata.json'
),
(
    'Debussy — Clair de Lune',
    'Piano arrangement of Debussy''s Clair de Lune with detailed performance annotations. Includes PDF, MusicXML, and JSON metadata.',
    7.99,
    'bundles/debussy-clair-de-lune/metadata.json'
),
(
    'Jazz Standards Collection Vol. 1',
    'A curated set of 10 jazz standards with lead sheets, chord symbols, and harmonic analysis. PDF + MusicXML + JSON bundle.',
    19.99,
    'bundles/jazz-standards-vol1/metadata.json'
)
ON CONFLICT DO NOTHING;
