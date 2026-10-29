import copy
import csv
import json
import tempfile
import unittest
from pathlib import Path

import manage_literature as manager


class ReviewedImportTests(unittest.TestCase):
    def setUp(self):
        self.columns, self.rows = manager.read_csv(manager.MASTER)
        self.sources = json.loads(manager.SOURCES.read_text())

    def write(self, path, rows):
        with path.open('w', encoding='utf-8-sig', newline='') as handle:
            writer = csv.DictWriter(handle, self.columns)
            writer.writeheader(); writer.writerows(rows)

    def test_duplicate_append_never_changes_master(self):
        with tempfile.TemporaryDirectory() as folder:
            master, candidate = Path(folder)/'master.csv', Path(folder)/'candidate.csv'
            self.write(master, self.rows)
            self.write(candidate, [self.rows[0]])
            before = master.read_bytes()
            with self.assertRaisesRegex(ValueError, '중복'):
                manager.append_reviewed(master, candidate, self.sources)
            self.assertEqual(before, master.read_bytes())

    def test_next_reviewed_study_appends_without_whitelist_or_loss(self):
        row = copy.deepcopy(self.rows[0])
        row.update(study_id='paper-next', observation_id='next-observation', test_group_id='next-condition',
                   source_url='https://doi.org/10.1234/new-study', source_title='New study, a "quoted" title',
                   test_notes='First line\nSecond line')
        source = dict(self.sources[0], sourceId=row['study_id'], url=row['source_url'], title=row['source_title'])
        with tempfile.TemporaryDirectory() as folder:
            master, candidate = Path(folder)/'master.csv', Path(folder)/'candidate.csv'
            self.write(master, self.rows); self.write(candidate, [row])
            with self.assertRaisesRegex(ValueError, '원문 목록'):
                manager.append_reviewed(master, candidate, self.sources)
            summary = manager.append_reviewed(master, candidate, self.sources+[source])
            _, updated = manager.read_csv(master)
            self.assertEqual(self.rows, updated[:-1])
            self.assertEqual(row, updated[-1])
            self.assertEqual(summary['values'], len(self.rows)+1)
            self.assertEqual(summary['papers'], 6)

    def test_nonfinite_values_wrong_sample_status_and_mixed_statistics_are_rejected(self):
        for field, value in [('strength_mpa', 'NaN'), ('diameter_mm', '0'), ('value_statistic', 'CHARACTERISTIC'),
                             ('observation_level', 'SPECIMEN'), ('n_specimens', '6'), ('grain_angle_deg', '45')]:
            with self.subTest(field=field):
                row = dict(self.rows[0]); row[field] = value
                with self.assertRaises(ValueError):
                    manager.validate(self.columns, [row], self.sources)


if __name__ == '__main__':
    unittest.main()
