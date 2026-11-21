package io.github.eifv013.team3;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 수사 3팀 — 안드로이드 껍데기.
 *
 * 하는 일은 하나다: 화면 전체에 웹뷰를 깔고 게임 주소(BuildConfig.GAME_URL)를 연다.
 *   - 게임 본체는 APK 안에 없다. GitHub Pages 에 올라간 파일을 불러온다.
 *     그래서 패치는 서버의 파일만 바꾸면 되고, 앱은 다음에 켤 때(또는 게임 안의 "지금 업데이트"로) 새 버전을 받는다.
 *   - 한 번 열고 나면 게임의 서비스 워커(sw.js)가 파일을 저장해 두어 인터넷 없이도 열린다.
 *   - 게임 진행은 웹뷰의 localStorage 에 저장된다. 앱을 지우면 함께 사라진다.
 *
 * 7구역 껍데기에서 알림 기능을 뺀 판이다. 외부 라이브러리를 쓰지 않는다(빌드가 깨질 여지를 줄이기 위해).
 */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        try {
            web = new WebView(this);
        } catch (Throwable e) {
            // 기기에 "Android 시스템 WebView" 가 없거나 업데이트 중이면 여기서 실패한다. 죽지 않고 끝낸다.
            finish();
            return;
        }
        setContentView(web);
        // 게임의 첫 화면이 그려질 때까지 웹뷰를 숨긴다. 그동안은 창 바탕(남색 + 아이콘)이 보인다.
        web.setBackgroundColor(0xFF12151C);
        web.setVisibility(View.INVISIBLE);
        // 안전장치: "그려졌다"는 신호가 오지 않아도 8초 뒤에는 보여 준다(빈 화면에 갇히지 않게).
        web.postDelayed(this::reveal, 8000);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);                   // 게임이 자바스크립트다
        s.setDomStorageEnabled(true);                   // localStorage: 게임 저장
        s.setMediaPlaybackRequiresUserGesture(false);   // 효과음이 첫 터치 전에도 막히지 않게
        s.setTextZoom(100);                             // 기기의 "글자 크게" 설정이 한 화면 배치를 깨뜨리지 않게
        s.setSupportZoom(false);
        s.setAllowFileAccess(false);                    // 기기 파일을 읽을 일이 없다
        s.setAllowContentAccess(false);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.setWebChromeClient(new WebChromeClient());

        web.setWebViewClient(new WebViewClient() {
            /** 게임 주소만 앱 안에서 연다. 그 밖의 링크는 바깥 브라우저로 보낸다. */
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = String.valueOf(request.getUrl());
                if (Links.isGame(url, BuildConfig.GAME_URL)) return false;
                openOutside(url);
                return true;
            }

            /** 페이지의 첫 내용이 화면에 그려졌다. 이제 웹뷰를 보여 준다(게임의 로딩 화면이 이어서 보인다). */
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                reveal();
            }

            /** 첫 화면을 못 받았을 때(처음 켜는데 인터넷이 없는 경우)만 안내 화면을 보여 준다. */
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame()) showOffline();
            }
        });

        if (saved == null || web.restoreState(saved) == null) web.loadUrl(BuildConfig.GAME_URL);
    }

    /** 숨겨 둔 웹뷰를 보여 준다. 여러 번 불려도 괜찮다. */
    private void reveal() {
        if (web != null) web.setVisibility(View.VISIBLE);
    }

    /** 바깥 브라우저로 연다. https 주소만 내보낸다. 열 앱이 없어도 죽지 않는다. */
    private void openOutside(String url) {
        if (url == null || !url.startsWith("https://")) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception e) {
            // 브라우저가 없는 기기: 조용히 넘어간다.
        }
    }

    /** 인터넷이 없어 게임을 받지 못했을 때의 안내. "다시 시도"는 게임 주소로 가는 평범한 링크다. */
    private void showOffline() {
        String html = "<!doctype html><html lang='ko'><meta charset='utf-8'>"
            + "<meta name='viewport' content='width=device-width, initial-scale=1'>"
            + "<body style='margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;"
            + "background:#12151C;color:#F3F0E8;font-family:sans-serif;text-align:center;padding:24px;box-sizing:border-box'>"
            + "<h1 style='font-size:28px;margin:0 0 12px;color:#FFD23F'>수사 3팀</h1>"
            + "<p style='margin:0 0 24px;line-height:1.6'>게임을 받아 오지 못했어요.<br>처음 한 번은 인터넷 연결이 필요해요.</p>"
            + "<a href='" + BuildConfig.GAME_URL + "' style='background:#FFD23F;color:#12151C;font-weight:bold;"
            + "padding:14px 28px;border-radius:14px;text-decoration:none'>다시 시도</a></body></html>";
        web.loadDataWithBaseURL(BuildConfig.GAME_URL, html, "text/html", "utf-8", null);
        reveal();
    }

    /* 앱이 가려지면 웹뷰도 쉬게 한다. 게임은 이때 저장한다(페이지의 visibilitychange). */
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    /**
     * 뒤로 가기: 먼저 게임에게 묻는다(window.Team3Back). 게임이 창을 닫거나 화면을 옮겼으면("stay") 그대로 있고,
     * 더 물러날 곳이 없다고 하면("exit") 앱을 끝내지 않고 뒤로 보낸다(실수로 눌러도 처음부터 다시 열리지 않게).
     * 게임이 아직 뜨지 않았으면 바로 뒤로 보낸다.
     */
    @Override
    public void onBackPressed() {
        if (web == null) { moveTaskToBack(true); return; }
        try {
            web.evaluateJavascript(
                "(function(){try{return window.Team3Back?String(window.Team3Back()):'exit'}catch(e){return 'exit'}})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (value == null || !value.contains("stay")) moveTaskToBack(true);
                    }
                });
        } catch (Exception e) {
            moveTaskToBack(true);
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.stopLoading(); web.destroy(); web = null; }
        super.onDestroy();
    }
}
