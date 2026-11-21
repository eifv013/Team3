package io.github.eifv013.team3;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** BackExit 단위 테스트. GitHub Actions 에서 APK 를 만들기 전에 돌린다. */
public class BackExitTest {
    @Test public void 처음_누르면_끄지_않는다() {
        assertFalse(BackExit.shouldExit(0, 5000, 2000));
    }

    @Test public void 이초_안에_다시_누르면_끈다() {
        assertTrue(BackExit.shouldExit(1000, 1001, 2000));
        assertTrue(BackExit.shouldExit(1000, 3000, 2000));   // 딱 2초
    }

    @Test public void 늦게_누르면_다시_처음부터() {
        assertFalse(BackExit.shouldExit(1000, 3001, 2000));
    }

    @Test public void 시계가_이상해도_끄지_않는다() {
        assertFalse(BackExit.shouldExit(5000, 4000, 2000));  // 시계가 뒤로 감
        assertFalse(BackExit.shouldExit(-1, 100, 2000));
        assertFalse(BackExit.shouldExit(1000, 1500, 0));
    }
}
