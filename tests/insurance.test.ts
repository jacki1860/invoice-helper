import assert from 'node:assert/strict';
import test from 'node:test';
import { insuranceData } from '../src/data/insurance.ts';
import {
  findInsuranceBracket,
  getHealthBrackets,
  getLaborBrackets,
  laborIdentities,
  parseInsuranceRange,
  parseInsuranceSalary,
  validateInsuranceBrackets,
} from '../src/domain/insurance.ts';
import type { LaborIdentity } from '../src/domain/insurance.ts';

const general = getLaborBrackets(insuranceData.labor.rows, '一般勞工');
const health = getHealthBrackets(insuranceData.health.rows);

test('reviewed official snapshots retain version, provenance, raw schemas and complete row counts', () => {
  assert.equal(insuranceData.labor.effectiveFrom, '2026-01-01');
  assert.equal(insuranceData.health.effectiveFrom, '2026-01-01');
  assert.equal(insuranceData.labor.rows.length, 97);
  assert.equal(insuranceData.health.rows.length, 58);
  assert.equal(insuranceData.labor.byteLength, 16210);
  assert.equal(insuranceData.health.byteLength, 2810);
  assert.equal(
    insuranceData.labor.sha256,
    'ad58189d46a276917d809b2b2a9fc6be2cb3f93afe8c9b9db8c6d80779bc5917',
  );
  assert.equal(
    insuranceData.health.sha256,
    '50b6a40393d30cec582fab1e50652dc19122acb039d6a06fd88e701fe354ca41',
  );
  const expectedCounts: Record<LaborIdentity, number> = {
    一般勞工: 11,
    部分工時勞工: 28,
    庇護性身心障礙者: 32,
    職訓機構受訓者: 26,
  };
  assert.deepEqual(
    new Set(insuranceData.labor.rows.map((row) => row.身分別)),
    new Set(laborIdentities),
  );
  for (const identity of laborIdentities) {
    assert.equal(
      getLaborBrackets(insuranceData.labor.rows, identity).length,
      expectedCounts[identity],
    );
  }
  insuranceData.labor.rows.forEach((row, index) => {
    assert.equal(row.適用起日, '1150101');
    assert.equal(row.序號, String(index + 1));
    assert.deepEqual(Object.keys(row), [
      '適用起日',
      '序號',
      '身分別',
      '投保薪資等級',
      '月薪資總額',
      '月投保薪資',
    ]);
  });
  insuranceData.health.rows.forEach((row, index) => {
    assert.equal(row.投保等級, String(index + 1));
    assert.deepEqual(Object.keys(row), [
      '組別級距',
      '投保等級',
      '月投保金額（元）',
      '實際薪資月額（元）',
    ]);
  });
});

test('salary parser accepts positive integer dollars and valid comma grouping without silently rounding', () => {
  for (const [input, expected] of [
    ['1', 1],
    [' 35000 ', 35000],
    ['35,000', 35000],
    ['1,000,000', 1000000],
  ] as const) {
    assert.equal(parseInsuranceSalary(input), expected);
  }
  for (const input of [
    '',
    ' ',
    '0',
    '-1',
    '35000.0',
    '35,00',
    '1,00,000',
    '1e5',
    '+35000',
    'NaN',
    'Infinity',
    '35000元',
    '9_000',
    '9007199254740992',
  ]) {
    assert.equal(parseInsuranceSalary(input), null, input);
  }
});

test('general labor below minimum, exact endpoints, one-dollar transitions and cap match the official table', () => {
  for (const [salary, amount, grade] of [
    [1, 29500, 1],
    [8800, 29500, 1],
    [29500, 29500, 1],
    [29501, 30300, 2],
    [30300, 30300, 2],
    [30301, 31800, 3],
    [43900, 43900, 10],
    [43901, 45800, 11],
    [45800, 45800, 11],
    [45801, 45800, 11],
    [1000000, 45800, 11],
  ]) {
    const row = findInsuranceBracket(general, salary);
    assert.equal(row?.amount, amount, String(salary));
    assert.equal(row?.grade, grade, String(salary));
  }
  assert.equal(general[10].sourceRange, '43901元以上');
});

test('the same salary uses distinct official labor identity tables without inferring identity', () => {
  const expected = {
    一般勞工: 29500,
    部分工時勞工: 11100,
    庇護性身心障礙者: 9900,
    職訓機構受訓者: 13500,
  };
  for (const identity of laborIdentities) {
    assert.equal(
      findInsuranceBracket(getLaborBrackets(insuranceData.labor.rows, identity), 8800)?.amount,
      expected[identity],
    );
  }
  const partTime = getLaborBrackets(insuranceData.labor.rows, '部分工時勞工');
  for (const [salary, amount] of [
    [11100, 11100],
    [11101, 12540],
    [27601, 28590],
    [28590, 28590],
    [28591, 29500],
    [43901, 45800],
  ]) {
    assert.equal(findInsuranceBracket(partTime, salary)?.amount, amount);
  }
  const sheltered = getLaborBrackets(insuranceData.labor.rows, '庇護性身心障礙者');
  assert.equal(findInsuranceBracket(sheltered, 6000)?.amount, 6000);
  assert.equal(findInsuranceBracket(sheltered, 6001)?.amount, 7500);
});

test('health retains all 58 levels beyond the labor cap and has no part-time low bracket', () => {
  for (const [salary, amount, grade] of [
    [8800, 29500, 1],
    [29500, 29500, 1],
    [29501, 30300, 2],
    [45800, 45800, 11],
    [45801, 48200, 12],
    [72800, 72800, 21],
    [72801, 76500, 22],
    [147901, 150000, 38],
    [150001, 156400, 39],
    [303000, 303000, 57],
    [303001, 313000, 58],
    [313000, 313000, 58],
    [1000000, 313000, 58],
  ]) {
    assert.equal(findInsuranceBracket(health, salary)?.amount, amount, String(salary));
    assert.equal(findInsuranceBracket(health, salary)?.grade, grade, String(salary));
  }
  assert.equal(health[57].sourceRange, '303001以上');
});

test('every official interval includes its endpoints and moves up on the next dollar', () => {
  for (const rows of [
    health,
    ...laborIdentities.map((identity) => getLaborBrackets(insuranceData.labor.rows, identity)),
  ]) {
    validateInsuranceBrackets(rows);
    for (const row of rows) {
      if (row.lowerInclusive !== null)
        assert.equal(findInsuranceBracket(rows, row.lowerInclusive)?.grade, row.grade);
      if (row.upperInclusive !== null) {
        assert.equal(findInsuranceBracket(rows, row.upperInclusive)?.grade, row.grade);
        assert.equal(findInsuranceBracket(rows, row.upperInclusive + 1)?.grade, row.grade + 1);
      }
    }
    for (const salary of [0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal(findInsuranceBracket(rows, salary), null);
    }
    assert.equal(
      findInsuranceBracket(rows, Number.MAX_SAFE_INTEGER)?.amount,
      rows[rows.length - 1].amount,
    );
  }
});

test('unknown source formats, missing rows and overlapping or reversed ranges fail visibly', () => {
  assert.deepEqual(parseInsuranceRange('29500元以下'), {
    lowerInclusive: null,
    upperInclusive: 29500,
  });
  assert.deepEqual(parseInsuranceRange('303001以上'), {
    lowerInclusive: 303001,
    upperInclusive: null,
  });
  for (const value of ['29,500以下', '任意薪資', '100-50', '0以下', '1.5至20']) {
    assert.throws(() => parseInsuranceRange(value));
  }
  assert.throws(() => validateInsuranceBrackets([]));
  assert.throws(() => validateInsuranceBrackets(general.slice(1)));
  assert.throws(() =>
    validateInsuranceBrackets([
      general[0],
      { ...general[1], lowerInclusive: 29500 },
      ...general.slice(2),
    ]),
  );
  assert.throws(() =>
    validateInsuranceBrackets([general[0], { ...general[1], grade: 3 }, ...general.slice(2)]),
  );
});
