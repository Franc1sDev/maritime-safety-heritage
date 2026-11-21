import 'package:flutter_test/flutter_test.dart';
import 'package:maritime_heritage/core.dart';

void main() {
  test('shortens large counts', () {
    expect(compact(950), '950');
    expect(compact(1500), '1.5k');
    expect(compact(2400000), '2.4M');
  });

  test('writes dates the Kenyan way and keeps plain dates on their day', () {
    expect(fmtDate('1994-04-29'), '29 Apr 1994');
    expect(fmtDate(null), '');
  });

  test('fills in values and falls back to English', () {
    expect(t('{n} stories', {'n': 3}), '3 stories');
    expect(t('Share my story'), 'Share my story');
  });

  test('reads names for contributors, admins and anonymous posts', () {
    expect(personName({'username': 'amina', 'role': 'contributor', 'name': 'Amina'}), '@amina');
    expect(personName({'username': null, 'role': 'admin', 'name': 'Admin – Grace'}), 'Admin – Grace');
    expect(personName(null), 'A contributor');
  });

  test('reads loose JSON safely', () {
    expect(asMap(null), isEmpty);
    expect(asList('x'), isEmpty);
    expect(num0('12'), 12);
    expect(str(null, 'd'), 'd');
  });
}
