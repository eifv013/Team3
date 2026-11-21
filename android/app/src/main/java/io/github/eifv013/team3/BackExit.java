package io.github.eifv013.team3;

/**
 * 뒤로 단추 두 번 눌러 끄기의 규칙. 안드로이드 클래스를 쓰지 않아 PC 단위 테스트로 검증한다(BackExitTest).
 */
final class BackExit {
    private BackExit() {}

    /**
     * 이번 누름에서 앱을 꺼야 하는가.
     * @param armedAt 첫 번째로 누른 시각(밀리초). 0 이하면 아직 안 누른 것.
     * @param now     지금 시각(밀리초, 기기가 켜진 뒤 흐른 시간처럼 뒤로 가지 않는 시계)
     * @param window  두 번째 누름을 받아 주는 시간(밀리초)
     * @return 첫 누름 뒤 window 안에 다시 눌렀으면 true. 시계가 뒤로 갔거나 너무 늦었으면 false(다시 첫 누름으로 본다).
     */
    static boolean shouldExit(long armedAt, long now, long window) {
        if (armedAt <= 0 || window <= 0) return false;
        long dt = now - armedAt;
        return dt >= 0 && dt <= window;
    }
}
