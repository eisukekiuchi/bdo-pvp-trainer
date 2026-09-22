# Windows入力ブリッジ

Web版PvP Trainer本体はRailwayで動作します。これは黒い砂漠を操作している最中の**ゲーム用入力だけ**をWeb版へ送る補助ツールです。

送信対象は W/A/S/D、Shift、Space、E/F/C/X/Z/Q/R、数字1〜9、左/右クリックだけです。文章入力、その他のキー、クリップボード等は送信しません。

## 起動

1. Python 3.11+ を用意
2. このフォルダで `pip install -r requirements.txt`
3. Web版の「画面観察・学習」を開き、表示された接続コードを確認
4. `python input_bridge.py 接続コード`

例:

```
python input_bridge.py A1B2C3
```

Web側が「Windows入力ブリッジ接続済み」になれば、黒い砂漠操作中の対象キーをコンボ記録へ使えます。
