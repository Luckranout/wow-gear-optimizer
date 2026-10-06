import json
import os
import sys
import urllib.parse
import urllib.request

API_BASE = "https://us.api.blizzard.com"
TOKEN_URL = "https://oauth.battle.net/token"
OUTPUT = "data/current-retail.json"


def request_json(url, headers=None, data=None):
    request = urllib.request.Request(
        url,
        headers=headers or {},
        data=data,
        method="POST" if data is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def get_access_token(client_id, client_secret):
    body = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    auth = (f"{client_id}:{client_secret}").encode()
    import base64
    encoded = base64.b64encode(auth).decode()

    return request_json(
        TOKEN_URL,
        headers={
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data=body,
    )["access_token"]


def get_api_json(path, token, params=None):
    query = urllib.parse.urlencode(params or {})
    url = f"{API_BASE}{path}"
    if query:
        url += f"?{query}"

    return request_json(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
    )


def main():
    client_id = os.environ.get("BLIZZARD_CLIENT_ID")
    client_secret = os.environ.get("BLIZZARD_CLIENT_SECRET")

    if not client_id or not client_secret:
        print("Missing BLIZZARD_CLIENT_ID or BLIZZARD_CLIENT_SECRET GitHub secrets.")
        sys.exit(1)

    token = get_access_token(client_id, client_secret)

    # First live API check. This deliberately imports metadata before the
    # larger item/enhancement import is enabled.
    namespace = "static-us"
    item_classes = get_api_json(
        "/data/wow/item-class/index",
        token,
        {"namespace": namespace, "locale": "en_US"},
    )

    with open(OUTPUT, "r", encoding="utf-8") as handle:
        dataset = json.load(handle)

    dataset["status"] = "blizzard-api-connected"
    dataset["source"] = "Blizzard Game Data API"
    dataset["apiCheck"] = {
        "itemClassCount": len(item_classes.get("item_classes", [])),
        "namespace": namespace,
    }

    with open(OUTPUT, "w", encoding="utf-8") as handle:
        json.dump(dataset, handle, indent=2)
        handle.write("\n")

    print(f"Blizzard API connection verified. Item classes: {len(item_classes.get('item_classes', []))}")


if __name__ == "__main__":
    main()
