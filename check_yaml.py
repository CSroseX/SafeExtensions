import yaml

with open(".github/workflows/ci.yml", "r") as f:
    yaml.safe_load(f)

print("YAML syntax is valid")
