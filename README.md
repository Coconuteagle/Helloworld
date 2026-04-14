# Apex Sprint Lap

모바일 스와이프 중심의 탑다운 아케이드 레이싱 게임입니다. 한 개의 서킷에서 3랩 타임어택을 진행하고, AI 라이벌 3대와 함께 최고 기록을 겨룹니다.

## 기능
- 자동 가속 + 좌우 스와이프/드래그 조향
- 데스크톱 방향키 및 `A` / `D` 보조 조작
- 체크포인트 순서 검증이 있는 랩 판정
- 로컬 최고 랩타임 저장
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

`game-core.js`의 랩 규칙, 게이트 판정, 트랙 판정, 입력 보정, 순위 계산을 Node 내장 테스트 러너로 검증합니다.

## 예상 배포 주소

GitHub Pages가 `main` 브랜치 루트를 서빙하도록 설정되어 있으면:

`https://coconuteagle.github.io/Helloworld/`
