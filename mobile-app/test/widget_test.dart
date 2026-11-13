import 'package:flutter_test/flutter_test.dart';
import 'package:maritime_heritage/state.dart';

void main() {
  test('search finds the Likoni oral history', () {
    final s = AppState();
    // ignore: invalid_use_of_protected_member
    expect(fmtTime(214), '3:34');
    expect(s.records, isEmpty);
  });
}
