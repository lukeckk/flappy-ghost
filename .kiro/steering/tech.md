# Technology Stack & Commands

## AWS Configuration
- **AWS CLI Profile**: Always use `kiro-eks-workshop` profile for all AWS commands
- All AWS CLI commands should include `--profile kiro-eks-workshop`
- Example: `aws eks list-clusters --profile kiro-eks-workshop`

## Version Checking
- When checking package versions, use `--version` flag if `version` subcommand fails
- Try `tool --version` before `tool version`
- Common tools: `kubectl --version`, `aws --version`, `docker --version`

## Key Technologies
- **Container Platform**: Docker, Kubernetes
- **Cloud Provider**: AWS (EKS, ECR, VPC, IAM)
- **CLI Tools**: kubectl, aws-cli, docker
- **Infrastructure**: EKS clusters, container registries

## Common Commands
```bash
# AWS EKS operations (with profile)
aws eks list-clusters --profile kiro-eks-workshop
aws eks describe-cluster --name <cluster-name> --profile kiro-eks-workshop
aws eks update-kubeconfig --name <cluster-name> --profile kiro-eks-workshop

# Kubernetes operations
kubectl get nodes
kubectl get pods --all-namespaces
kubectl apply -f <manifest.yaml>

# Version checks
kubectl --version
aws --version
docker --version
```