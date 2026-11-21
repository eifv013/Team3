package io.github.eifv013.team3;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** Links.isGame 단위 테스트. GitHub Actions 에서 APK 를 만들기 전에 돌린다. */
public class LinksTest {
    private static final String GAME = "https://eifv013.github.io/Team3/";

    @Test public void 게임_폴더_아래는_앱_안에서_연다() {
        assertTrue(Links.isGame(GAME, GAME));
        assertTrue(Links.isGame(GAME + "index.html", GAME));
        assertTrue(Links.isGame(GAME + "version.json?t=123", GAME));
        assertTrue(Links.isGame("https://eifv013.github.io/team3/", GAME));       // 대소문자
        assertTrue(Links.isGame("https://eifv013.github.io/Team3", GAME));        // 끝 빗금 없음
        assertTrue(Links.isGame("https://EIFV013.github.io/Team3/#x", GAME));
    }

    @Test public void 다른_곳은_바깥_브라우저로_보낸다() {
        assertFalse(Links.isGame("https://github.com/eifv013/Team3", GAME));         // 다른 서버
        assertFalse(Links.isGame("https://eifv013.github.io/", GAME));               // 같은 서버의 다른 폴더
        assertFalse(Links.isGame("https://eifv013.github.io/Team3evil/", GAME));     // 이름만 비슷한 폴더
        assertFalse(Links.isGame("https://eifv013.github.io.evil.com/Team3/", GAME));
        assertFalse(Links.isGame("https://eifv013.github.io:8443/Team3/", GAME));
        assertFalse(Links.isGame("http://eifv013.github.io/Team3/", GAME));          // 암호화되지 않은 연결
    }

    @Test public void 이상한_입력에도_죽지_않는다() {
        assertFalse(Links.isGame(null, GAME));
        assertFalse(Links.isGame(GAME, null));
        assertFalse(Links.isGame("", GAME));
        assertFalse(Links.isGame("not a url", GAME));
        assertFalse(Links.isGame("javascript:alert(1)", GAME));
        assertFalse(Links.isGame("intent://x#Intent;end", GAME));
        assertFalse(Links.isGame("mailto:a@b.c", GAME));
    }
}
