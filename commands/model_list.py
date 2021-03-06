import os
from configs import *

def get_models_with_prefix(prefix:str):
    """
    Given a prefix, return all model names that match the prefix
    :param prefix:str
    :return:list
    """
    return [ m for m in list_models() if m[:len(prefix)] == prefix]

def expand_wildcards(model_names):
    mdls = []
    for model in model_names:
        if model.endswith("*"):
            mdls.extend(get_models_with_prefix(model[:-1]))
        else:
            mdls.append(model)
    return mdls

def list_models():
    models = []
    curr_model_dir = os.path.join(config_model_dir(), get_version())
    for file in os.listdir(curr_model_dir):
        if os.path.isdir(os.path.join(curr_model_dir, file)):
            models.append(file)
    models.sort()
    return models

def execute():
    print("\n".join(list_models()))
