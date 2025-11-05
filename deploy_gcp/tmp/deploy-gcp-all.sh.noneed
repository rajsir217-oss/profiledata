 #!/bin/bash

eval ./pre-deploy-check.sh

./switch-environment.sh prod
# ./deploy-gcp.sh
./deploy_backend_simple.sh
./deploy_frontend_simple.sh

./switch-environment.sh local