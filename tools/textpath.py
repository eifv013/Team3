#!/usr/bin/env python3
"""글자를 SVG path 로 바꾼다(로고용: 폰트가 없는 곳에서도 모양이 같게). 사용: textpath(text, size, x, y, spacing) -> (path_d, width)"""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import pathlib
FONT = TTFont(str(pathlib.Path(__file__).resolve().parent.parent / 'assets/fonts/BlackHanSans-Regular.ttf'))
GS = FONT.getGlyphSet(); CMAP = FONT.getBestCmap(); UPM = FONT['head'].unitsPerEm

def textpath(text, size, x=0, y=0, spacing=0):
    sc = size / UPM; pen = SVGPathPen(GS); cx = x
    for ch in text:
        g = CMAP.get(ord(ch))
        if g is None: continue
        tp = TransformPen(pen, (sc, 0, 0, -sc, cx, y))
        GS[g].draw(tp)
        cx += GS[g].width * sc + spacing
    return pen.getCommands(), cx - x - spacing
