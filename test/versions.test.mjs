import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NODE_MIN_MAJOR,
  NODE_RECOMMENDED_MAJOR,
  JDK_MAJOR,
  MAVEN_MIN,
  nodeInfo,
  parseJava,
  parseMaven,
} from '../scripts/lib/versions.mjs';

test('shared thresholds', () => {
  assert.equal(NODE_MIN_MAJOR, 18);
  assert.equal(NODE_RECOMMENDED_MAJOR, 22);
  assert.equal(JDK_MAJOR, 17);
  assert.deepEqual(MAVEN_MIN, [3, 9]);
});

test('node levels', () => {
  assert.equal(nodeInfo('16.20.2').level, 'unsupported');
  assert.equal(nodeInfo('17.9.1').level, 'unsupported');
  assert.equal(nodeInfo('18.0.0').level, 'old');
  assert.equal(nodeInfo('21.7.3').level, 'old');
  assert.equal(nodeInfo('22.0.0').level, 'ok');
  assert.deepEqual(nodeInfo('22.23.5'), { version: '22.23.5', major: 22, level: 'ok' });
  assert.equal(nodeInfo().version, process.versions.node);
});

test('java -version parsing', () => {
  assert.deepEqual(parseJava('openjdk version "17.0.18" 2026-01-20\nOpenJDK Runtime Environment Temurin-17.0.18+8\n'), {
    found: true,
    version: '17.0.18',
    major: 17,
    ok: true,
    line: 'openjdk version "17.0.18" 2026-01-20',
  });
  const legacy = parseJava('java version "1.8.0_292"');
  assert.equal(legacy.major, 8);
  assert.equal(legacy.ok, false);
  assert.equal(parseJava('openjdk version "21.0.1" 2023-10-17').ok, false);
  const picked = parseJava('\nPicked up JAVA_TOOL_OPTIONS: -Dx=1\nopenjdk version "17" 2021-09-14');
  assert.equal(picked.major, 17);
  assert.equal(picked.line, 'Picked up JAVA_TOOL_OPTIONS: -Dx=1');
  assert.equal(parseJava('').found, false);
  assert.equal(parseJava('Unable to locate a Java Runtime.').found, false);
});

test('mvn -version parsing', () => {
  assert.deepEqual(parseMaven('Apache Maven 3.9.9 (8e8579a9)\nMaven home: /opt/maven\n'), {
    found: true,
    version: '3.9.9',
    major: 3,
    minor: 9,
    ok: true,
    line: 'Apache Maven 3.9.9 (8e8579a9)',
  });
  assert.equal(parseMaven('Apache Maven 3.8.8 (4c87b05d)').ok, false);
  assert.equal(parseMaven('Apache Maven 4.0.0-rc-2 (x)').version, '4.0.0-rc-2');
  assert.equal(parseMaven('\u001b[1mApache Maven 3.9.9\u001b[m (x)').version, '3.9.9');
  assert.equal(parseMaven('').found, false);
});
