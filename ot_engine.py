def transform(op1, op2):
    if op1["type"] == "insert" and op2["type"] == "insert":
        if op2["pos"] <= op1["pos"]:
            return {**op1, "pos": op1["pos"] + len(op2["chars"])}

    elif op1["type"] == "insert" and op2["type"] == "delete":
        if op2["pos"] < op1["pos"]:
            shift = min(len(op2["chars"]), op1["pos"] - op2["pos"])
            return {**op1, "pos": op1["pos"] - shift}

    elif op1["type"] == "delete" and op2["type"] == "insert":
        if op2["pos"] <= op1["pos"]:
            return {**op1, "pos": op1["pos"] + len(op2["chars"])}

    elif op1["type"] == "delete" and op2["type"] == "delete":
        if op2["pos"] < op1["pos"]:
            shift = min(len(op2["chars"]), op1["pos"] - op2["pos"])
            return {**op1, "pos": op1["pos"] - shift}
        elif op2["pos"] == op1["pos"]:
            return None

    return op1


def apply_op(content, op):
    if op is None:
        return content
    pos = max(0, min(op["pos"], len(content)))
    if op["type"] == "insert":
        return content[:pos] + op["chars"] + content[pos:]
    elif op["type"] == "delete":
        end = min(pos + len(op["chars"]), len(content))
        return content[:pos] + content[end:]
    return content


def transform_against_history(op, history, since_revision):
    concurrent_ops = history[since_revision:]
    transformed = op
    for past_op in concurrent_ops:
        if transformed is None:
            break
        transformed = transform(transformed, past_op)
    return transformed