import os
from configs import *
from commands.model_create import generate_lyt_from_lrt_if_missing
from EXparser.Txt2Vec import text_to_vec
from EXparser.Feature_Extraction import extract_features
from EXparser.Training_Ext import train_extraction
from EXparser.Training_Seg import train_segmentation
from EXparser.Training_Com import train_completeness


def call_extraction_training(model_name: str, version=None):
    generate_lyt_from_lrt_if_missing(model_name)
    extract_features(os.path.join(config_dataset_dir(), model_name))
    text_to_vec(os.path.join(config_dataset_dir(), model_name))
    train_extraction(config_dataset_dir(model_name), config_model_dir(model_name, version))


def call_segmentation_training(model_name: str, version=None):
    extract_features(os.path.join(config_dataset_dir(), model_name))
    text_to_vec(os.path.join(config_dataset_dir(), model_name))
    train_segmentation(config_dataset_dir(model_name), config_model_dir(model_name, version))


def call_completeness_training(model_name: str, version=None):
    extract_features(config_dataset_dir(model_name))
    text_to_vec(config_dataset_dir(model_name))
    train_completeness(config_dataset_dir(model_name), config_model_dir(model_name, version))
