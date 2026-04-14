# Apex Sprint Lap

설정 가능한 탑다운 아케이드 레이싱 게임입니다. 코스를 고르고, AI 수와 랩 수를 조절한 뒤, 가상 핸들과 액션 패드로 랩타임을 겨룹니다.

## 기능
- 5개 코스 선택: Rookie Loop / Velocity Ring / Grand Circuit / Marathon Bend / Technical Maze
- 설정 가능: AI `0-7`, 랩 수 `1-10`
- 좌측 가상 핸들 + 우측 `Brake / Boost / Drift` 패드
- 데스크톱 방향키 및 `A` / `D`, `Space`, `Shift`, `B` 보조 조작
- 체크포인트 순서 검증이 있는 랩 판정
- 코스별 로컬 최고 랩타임 저장
- 일시정지 메뉴에서 세팅 변경 후 `Apply & Restart`
- GitHub Pages에 바로 올릴 수 있는 순수 HTML/CSS/JS 구조

## 로컬 실행
정적 파일이라 별도 빌드는 필요 없습니다.

```bash
python3 -m http.server 4173
```

브라우저에서 `http://127.0.0.1:4173`을 열면 됩니다.

## 테스트

```bash
npm test
```

`game-core.js`의 랩 규칙, 트랙 프리셋, 세션 설정, 휠 정규화, 부스트 게이지 계산을 Node 내장 테스트 러너로 검증합니다.

## 예상 배포 주소

GitHub Pages가 `main` 브랜치 루트를 서빙하도록 설정되어 있으면:

`https://coconuteagle.github.io/Helloworld/`
