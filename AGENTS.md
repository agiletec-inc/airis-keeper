# AIris Keeper

AI agent向けcredentialのscope、TTL、budget、監査を扱うTypeScript CLI/library。秘匿だけでなく、漏洩時の
blast radiusを小さくすることを目的とする。

## 推測できない境界

- plain npm packageであり、`manifest.toml`や`airis gen`を使わない。
- `organizationId`はDB queryとtenant key derivationの両方へ必ず伝播する。片方だけのscopeはtenant分離にならない。
- relative ESM importはNode16解決に合わせ`.js`拡張子を付ける。testは周辺実装へ合わせる。
- root key、service-role key、provider admin keyを出力・永続化・test fixtureへ混入させない。
- READMEにある`keeper init`、`status`、`provider add`、top-level `rotate`は未実装。CLIとtestを確認せず追加済みと扱わない。
- public APIを追加した場合は`src/index.ts`のexport契約を同時に更新する。

command、構成、環境変数、mock patternは`package.json`、source、近接testから作業時だけ読む。
