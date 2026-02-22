.PHONY: deploy redeploy redeploy-all install-statusd install-ddns verify verify-web smoke backup restore fmt-go test

deploy: redeploy

redeploy:
	./deploy/scripts/redeploy.sh

redeploy-all:
	./deploy/scripts/redeploy-all.sh

install-statusd:
	./deploy/scripts/install-statusd.sh

install-ddns:
	./deploy/scripts/install-ddns.sh

verify:
	./deploy/scripts/verify-monitoring.sh

verify-web:
	./deploy/scripts/verify-web.sh

smoke:
	./deploy/scripts/smoke.sh

backup:
	./deploy/scripts/backup-volumes.sh

restore:
	@echo "Usage: ./deploy/scripts/restore-volumes.sh <backup-dir>"
	@exit 1

fmt-go:
	cd status-service && gofmt -w ./cmd ./internal

test:
	cd status-service && GOCACHE=/tmp/go-build go test ./...
