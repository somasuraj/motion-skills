#!/usr/bin/env python3
"""List the resources and connections in infrastructure code, with suggested official icons.

    python scan_infra.py <file or folder> [...]  [--json out.json]

Reads, recursively:
  CloudFormation / SAM templates (*.yaml, *.yml, *.json with "Resources"), CDK output (cdk.out/*.template.json)
  Terraform (*.tf)
  Docker Compose (docker-compose*.yml, compose*.yml)
  Kubernetes manifests (*.yaml with apiVersion/kind)

It extracts; it does not draw. Read the summary, decide what the diagram should show (usually the
request path and the data stores, not every IAM role), then write the diagram script. Resources that
are plumbing (roles, policies, permissions, outputs, log groups) are listed under "skipped".
"""
import argparse
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from icons import score, INDEX  # noqa: E402

PLUMBING = re.compile(r"(IAM|Policy|Role|Permission|LogGroup|Output|Version|Alias|Attachment|Association|"
                      r"RouteTable|Route$|SubnetRouteTable|VPCGatewayAttachment|EIP|SecurityGroupIngress|"
                      r"SecurityGroupEgress|LaunchTemplate|Metadata|CDKMetadata|Lambda::Permission|"
                      r"aws_iam_|_policy|_role|_attachment|random_|null_resource|local_|time_)", re.I)

# Common types -> bundled icon ids (anything else falls back to icon search on the type's words)
ICON = {
    "AWS::Lambda::Function": "aws/lambda", "AWS::Serverless::Function": "aws/lambda", "aws_lambda_function": "aws/lambda",
    "AWS::ApiGateway::RestApi": "aws/api-gateway", "AWS::ApiGatewayV2::Api": "aws/api-gateway", "AWS::Serverless::Api": "aws/api-gateway",
    "aws_api_gateway_rest_api": "aws/api-gateway", "aws_apigatewayv2_api": "aws/api-gateway",
    "AWS::DynamoDB::Table": "aws/dynamodb", "AWS::Serverless::SimpleTable": "aws/dynamodb", "aws_dynamodb_table": "aws/dynamodb",
    "AWS::S3::Bucket": "aws/simple-storage-service", "aws_s3_bucket": "aws/simple-storage-service",
    "AWS::SQS::Queue": "aws/simple-queue-service", "aws_sqs_queue": "aws/simple-queue-service",
    "AWS::SNS::Topic": "aws/simple-notification-service", "aws_sns_topic": "aws/simple-notification-service",
    "AWS::Events::Rule": "aws/eventbridge", "AWS::Events::EventBus": "aws/eventbridge", "aws_cloudwatch_event_rule": "aws/eventbridge",
    "AWS::StepFunctions::StateMachine": "aws/step-functions", "aws_sfn_state_machine": "aws/step-functions",
    "AWS::RDS::DBInstance": "aws/rds", "AWS::RDS::DBCluster": "aws/aurora", "aws_db_instance": "aws/rds", "aws_rds_cluster": "aws/aurora",
    "AWS::ElastiCache::CacheCluster": "aws/elasticache", "AWS::ElastiCache::ReplicationGroup": "aws/elasticache", "aws_elasticache_cluster": "aws/elasticache",
    "AWS::ECS::Service": "aws/elastic-container-service", "AWS::ECS::Cluster": "aws/elastic-container-service", "aws_ecs_service": "aws/elastic-container-service",
    "AWS::EKS::Cluster": "aws/elastic-kubernetes-service", "aws_eks_cluster": "aws/elastic-kubernetes-service",
    "AWS::EC2::Instance": "aws/ec2", "aws_instance": "aws/ec2", "AWS::AutoScaling::AutoScalingGroup": "aws/ec2-auto-scaling",
    "AWS::ElasticLoadBalancingV2::LoadBalancer": "aws/elastic-load-balancing", "aws_lb": "aws/elastic-load-balancing", "aws_alb": "aws/elastic-load-balancing",
    "AWS::CloudFront::Distribution": "aws/cloudfront", "aws_cloudfront_distribution": "aws/cloudfront",
    "AWS::Route53::HostedZone": "aws/route-53", "AWS::Route53::RecordSet": "aws/route-53", "aws_route53_zone": "aws/route-53", "aws_route53_record": "aws/route-53",
    "AWS::Cognito::UserPool": "aws/cognito", "aws_cognito_user_pool": "aws/cognito",
    "AWS::Kinesis::Stream": "aws/kinesis-data-streams", "aws_kinesis_stream": "aws/kinesis-data-streams",
    "AWS::KMS::Key": "aws/key-management-service", "aws_kms_key": "aws/key-management-service",
    "AWS::SecretsManager::Secret": "aws/secrets-manager", "aws_secretsmanager_secret": "aws/secrets-manager",
    "AWS::EC2::VPC": "aws/group/virtual-private-cloud-vpc", "aws_vpc": "aws/group/virtual-private-cloud-vpc",
    "AWS::ECR::Repository": "aws/elastic-container-registry", "aws_ecr_repository": "aws/elastic-container-registry",
    "azurerm_linux_web_app": "azure/app-services", "azurerm_windows_web_app": "azure/app-services", "azurerm_app_service": "azure/app-services",
    "azurerm_linux_function_app": "azure/function-apps", "azurerm_function_app": "azure/function-apps",
    "azurerm_mssql_database": "azure/sql-database", "azurerm_sql_database": "azure/sql-database",
    "azurerm_storage_account": "azure/storage-accounts", "azurerm_key_vault": "azure/key-vaults",
    "azurerm_servicebus_namespace": "azure/azure-service-bus", "azurerm_servicebus_queue": "azure/azure-service-bus",
    "azurerm_kubernetes_cluster": "azure/kubernetes-services", "azurerm_cosmosdb_account": "azure/azure-cosmos-db",
    "azurerm_virtual_network": "azure/virtual-networks", "azurerm_application_insights": "azure/application-insights",
    "azurerm_cdn_frontdoor_profile": "azure/front-door-and-cdn-profiles", "azurerm_redis_cache": "azure/cache-redis",
    "google_cloud_run_service": "gcp/cloud-run", "google_cloud_run_v2_service": "gcp/cloud-run", "google_cloudfunctions_function": "gcp/cloud-functions",
    "google_bigquery_dataset": "gcp/bigquery", "google_pubsub_topic": "gcp/pubsub", "google_storage_bucket": "gcp/cloud-storage",
    "google_sql_database_instance": "gcp/cloud-sql", "google_container_cluster": "gcp/google-kubernetes-engine", "google_compute_instance": "gcp/compute-engine",
    "Deployment": "k8s/deploy", "StatefulSet": "k8s/sts", "DaemonSet": "k8s/ds", "Service": "k8s/svc", "Ingress": "k8s/ing",
    "ConfigMap": "k8s/cm", "Secret": "k8s/secret", "PersistentVolumeClaim": "k8s/pvc", "CronJob": "k8s/cronjob", "Job": "k8s/job",
    "HorizontalPodAutoscaler": "k8s/hpa", "Namespace": "k8s/ns", "Pod": "k8s/pod",
}
IMAGES = {"postgres": "logo/postgresql", "mysql": "logo/mysql-icon", "mariadb": "logo/mariadb-icon", "redis": "logo/redis",
          "mongo": "logo/mongodb-icon", "nginx": "logo/nginx", "rabbitmq": "logo/rabbitmq-icon", "kafka": "logo/kafka-icon",
          "elasticsearch": "logo/elasticsearch", "grafana": "logo/grafana", "prometheus": "logo/prometheus", "traefik": "logo/traefik",
          "node": "logo/nodejs-icon", "python": "logo/python", "keycloak": "si/keycloak", "minio": "si/minio", "vault": "logo/vault-icon"}
IMAGES["traefik"] = "logo/traefik-proxy-icon"

_entries = None


def suggest(rtype):
    global _entries
    if rtype in ICON:
        return ICON[rtype]
    if _entries is None:
        _entries = json.loads(INDEX.read_text(encoding="utf-8"))
    words = re.sub(r"(AWS|Azure|azurerm|google|aws)[:_]+", "", rtype)
    words = re.sub(r"::|_", " ", words)
    words = re.sub(r"([a-z])([A-Z])", r"\1 \2", words)
    vendor = "aws" if rtype.startswith(("AWS::", "aws_")) else "azure" if rtype.startswith("azurerm") else "gcp" if rtype.startswith("google") else None
    pool = [e for e in _entries if not vendor or e["vendor"] == vendor]
    best = max(pool, key=lambda e: score(e, words), default=None)
    return best["id"] if best and score(best, words) > 0 else None


class Scan:
    def __init__(self):
        self.res, self.edges, self.skipped = [], [], []

    def add(self, rid, rtype, f, **kw):
        if PLUMBING.search(rtype) or PLUMBING.search(rid):
            self.skipped.append(f"{rid} ({rtype})")
            return
        self.res.append(dict(id=rid, type=rtype, file=str(f), icon=kw.pop("icon", None) or suggest(rtype), **kw))

    def edge(self, a, b, via):
        if a != b and (a, b) not in [(e["from"], e["to"]) for e in self.edges]:
            self.edges.append({"from": a, "to": b, "via": via})


def load_yaml_docs(text):
    try:
        import yaml  # type: ignore

        class L(yaml.SafeLoader):
            pass
        L.add_multi_constructor("!", lambda loader, suffix, node: {"Fn::" + suffix: loader.construct_scalar(node) if isinstance(node, yaml.ScalarNode) else loader.construct_sequence(node) if isinstance(node, yaml.SequenceNode) else loader.construct_mapping(node)})
        return [d for d in yaml.load_all(text, Loader=L) if d]
    except ImportError:
        return None
    except Exception:  # noqa: BLE001
        return []


def refs(obj, names):
    """Logical ids referenced anywhere inside a CloudFormation property tree."""
    out = set()
    s = json.dumps(obj, default=str)
    for n in names:
        if re.search(r'"(Ref|Fn::Ref|Fn::GetAtt)"\s*:\s*\[?\s*"' + re.escape(n) + r'[".]', s) or re.search(r"\$\{" + re.escape(n) + r"[.}]", s):
            out.add(n)
    return out


def scan_cfn(sc, f, doc):
    R = doc.get("Resources") or {}
    names = list(R)
    for n, r in R.items():
        sc.add(n, r.get("Type", "?"), f)
    kept = {r["id"] for r in sc.res}
    for n, r in R.items():
        for m in refs(r.get("Properties", {}), names) | set([r.get("DependsOn")] if isinstance(r.get("DependsOn"), str) else r.get("DependsOn") or []):
            if n in kept and m in kept:
                sc.edge(m, n, "reference")


def scan_tf(sc, f, text):
    blocks = list(re.finditer(r'resource\s+"([\w-]+)"\s+"([\w-]+)"\s*\{', text))
    spans = []
    for i, m in enumerate(blocks):
        end = blocks[i + 1].start() if i + 1 < len(blocks) else len(text)
        spans.append((m.group(1), m.group(2), text[m.end():end]))
        sc.add(f"{m.group(1)}.{m.group(2)}", m.group(1), f, name=m.group(2))
    kept = {r["id"] for r in sc.res}
    for t, n, body in spans:
        for m in re.finditer(r"\b([a-z][\w]*_[\w]+)\.([\w-]+)\.", body):
            a, b = f"{m.group(1)}.{m.group(2)}", f"{t}.{n}"
            if a in kept and b in kept:
                sc.edge(a, b, "reference")


def scan_compose(sc, f, doc):
    svcs = doc.get("services") or {}
    for n, s in svcs.items():
        img = str((s or {}).get("image", ""))
        icon = next((v for k, v in IMAGES.items() if k in img.lower() or k in n.lower()), None) or "generic/container"
        sc.add(n, "compose service", f, icon=icon, image=img, ports=(s or {}).get("ports"))
    for n, s in svcs.items():
        dep = (s or {}).get("depends_on") or []
        for d in (dep if isinstance(dep, list) else list(dep)):
            sc.edge(n, d, "depends_on")
        for d in (s or {}).get("links") or []:
            sc.edge(n, str(d).split(":")[0], "links")


def scan_k8s(sc, f, docs):
    objs = [d for d in docs if isinstance(d, dict) and d.get("kind") and d.get("metadata")]
    for d in objs:
        sc.add(f"{d['kind']}/{d['metadata'].get('name')}", d["kind"], f)
    labels = {f"{d['kind']}/{d['metadata'].get('name')}": ((((d.get('spec') or {}).get('template') or {}).get('metadata') or {}).get('labels') or {}) for d in objs}
    for d in objs:
        me = f"{d['kind']}/{d['metadata'].get('name')}"
        spec = d.get("spec") or {}
        if d["kind"] == "Service":
            sel = spec.get("selector") or {}
            for k, lab in labels.items():
                if sel and all(lab.get(a) == b for a, b in sel.items()):
                    sc.edge(me, k, "selector")
        if d["kind"] == "Ingress":
            for svc in set(re.findall(r'"name":\s*"([\w.-]+)"', json.dumps(spec.get("rules") or spec.get("defaultBackend") or {}))):
                sc.edge(me, f"Service/{svc}", "backend")
        s = json.dumps(spec)
        for kind, key in (("ConfigMap", "configMapRef|configMap"), ("Secret", "secretRef|secretName|secret")):
            for name in re.findall(r'"(?:%s)":\s*\{[^{}]*"name":\s*"([\w.-]+)"' % key, s):
                sc.edge(f"{kind}/{name}", me, "mount")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--json", help="also write the result as JSON")
    a = ap.parse_args()
    files = []
    for p in map(pathlib.Path, a.paths):
        files += [p] if p.is_file() else [q for q in p.rglob("*") if q.suffix in (".tf", ".yaml", ".yml", ".json") and "node_modules" not in q.parts and ".terraform" not in q.parts]
    sc = Scan()
    no_yaml = False
    for f in files:
        text = f.read_text(encoding="utf-8", errors="replace")
        if f.suffix == ".tf":
            scan_tf(sc, f, text)
            continue
        if f.suffix == ".json":
            try:
                doc = json.loads(text)
            except ValueError:
                continue
            if isinstance(doc, dict) and "Resources" in doc:
                scan_cfn(sc, f, doc)
            continue
        docs = load_yaml_docs(text)
        if docs is None:
            no_yaml = True
            continue
        if any(isinstance(d, dict) and "Resources" in d for d in docs):
            scan_cfn(sc, f, next(d for d in docs if isinstance(d, dict) and "Resources" in d))
        elif any(isinstance(d, dict) and "services" in d for d in docs) and re.search(r"compose", f.name, re.I):
            scan_compose(sc, f, next(d for d in docs if isinstance(d, dict) and "services" in d))
        elif any(isinstance(d, dict) and d.get("apiVersion") and d.get("kind") for d in docs):
            scan_k8s(sc, f, docs)
    if no_yaml:
        print("note: YAML files skipped; install PyYAML (pip install pyyaml) to read them", file=sys.stderr)
    print(f"{len(sc.res)} resources, {len(sc.edges)} connections, {len(sc.skipped)} skipped as plumbing\n")
    for r in sc.res:
        print(f"  {r['id']:<48} {r['type']:<44} icon: {r['icon'] or '(search icons.py)'}")
    if sc.edges:
        print("\nconnections (from -> to, how):")
        for e in sc.edges:
            print(f"  {e['from']} -> {e['to']}  ({e['via']})")
    if sc.skipped:
        print("\nskipped: " + ", ".join(sc.skipped[:40]) + (" …" if len(sc.skipped) > 40 else ""))
    if a.json:
        pathlib.Path(a.json).write_text(json.dumps({"resources": sc.res, "edges": sc.edges, "skipped": sc.skipped}, indent=1), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
