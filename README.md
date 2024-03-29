# EXcite-Docker: Tool for the annotation of training material for ML-based reference extraction and segmentation

> Note: This repository is no longer maintained. Current work has shifted to https://github.com/cboulanger/anystyle-workflow

This is a docker image that provides a web application to produce training
material for two ML-based reference extraction & segmentation engines:

- [EXParser](http://exparser.readthedocs.io)
- [AnyStyle](https://github.com/inukshuk/anystyle)

Both serve to extract citation data from PDF Documents. 

The image provides a Web UI for producing training material which is needed to
improve citation recognition for particular corpora of scholarly literature
where the current models does not perform well; and provides a CLI to run the
EXcite commands, manage multiple sets of model training data and model data, and
support an evaluation workflow that can measure the performance of the model.
The AnyStyle toolkit has its own CLI and evaluation built in. Currently, support 
for AnyStyle is limited to editing .ttx documents, more comprehensive integration 
will follow. 

The code has been forked from https://git.gesis.org/hosseiam/excite-docker, but
there is little of the original code left except the core EXparser algorithm.

A demo of the web frontend (without backend functionality) is available 
[here](https://cboulanger.github.io/excite-docker/web/index.html).

## Installation

1. Install [Docker](https://docs.docker.com/install)
2. Clone this repo with: `git clone https://github.com/cboulanger/excite-docker.git && cd excite-docker`
3. Build docker image: `./bin/build`
4. If you want to use AnyCite, please consult its GitHub page on how to install it: https://github.com/inukshuk/anystyle

## Use of the web frontend

1. Run server: `./bin/start-servers`
2. Open frontend at http://127.0.0.1:8000/web/index.html
3. Click on "Help" for instructions (also lets you download the Zotero add-ons)

## CLI

You can control the extraction and segmentation process via the CLI. CLI
commands can be executed with `./bin/run <command>` Available commands can be
listed with `./bin/run --help`, and you can always get detailed help on each
command with `./bin/run <command> [<subcommand>] --help`

The main commands for extracting references from PDFs are: 

- `layout`: run layout analysis of any PDF file in `Data/1-pdfs` and put the
  result into `Data/2-layout`
- `exparser`: process all the files in `Data/2-layout`. The output will be
  provided in  csv (plain text), xml and BibTex format in the directories
  `Data/3-refs`, `Data/3-refs_seg` and `Data/3-refs_bibtex`
- `segmentation`: process the references that are in the csv files in the
  `Data/3-refs` directory and output xml and BibTex files in 
  `Data/3-refs_seg` and `Data/3-refs_bibtex`

For more CLI commands, see the sections below.

## Training a new model

> If you want to use this feature, you need to have
[git-lfs](https://www.atlassian.com/git/tutorials/git-lfs) installed **before** you
check out this repository. git-lfs is necessary to download the large files that
are used during training.

In order to train a new model from scratch, you need to do the following:

1. Run `./bin/run model create <model_name>` 
2. Put the PDFs with which you are going to train the model into `Data/1-pdfs`
   if they are native PDFs or contain an OCR layer. If the PDFs consist of
   scanned pages without the OCR layer, put them into `0-pdfs_no_ocr` and wait
   for the OCR server to process them and move them to `Data/1-pdfs`
3. Create the layout files with `./bin/run layout`
4. Move files from `Data/2-layout` into `Dataset/<model_name>/LYT`
5. Load the web application and choose your new model from the "Model" dropdown
6. Use the web application to load and annotate the layout files from
   `Dataset/<model_name>/LYT` in the identification and segmentation
   views. Here is more information on training [the reference extraction
   model](https://exparser.readthedocs.io/en/latest/ReferenceExtraction/) and the
   [the reference parsing model](https://exparser.readthedocs.io/en/latest/ReferenceParsing/).
7. "Save" the training files after each annotation, they will be stored
   in the model directory
8. On the command line, run `./bin/train <model_name>`. If
you want to train extraction, segmentation and model completeness separately, use
`./bin/run train extraction <model_name>`, `train segmentation
<model_name>` or `train completeness
<model_name>`

Training data lives in the `Dataset/<model_name>`
folder. For details, see [here](./Dataset/README.md).

For training, you need to populate the following folders with training data:
```
Dataset/<model_name>/LYT/ - layout files
Dataset/<model_name>/LRT/ - layout files with annotation for references <ref>
Dataset/<model_name>/SEG/ - segmentation data for citations 
```

To run the training, execute `./bin/training <model_name>`.

This will generate data in the following folders:
```text
#feature extraction output
Dataset/<model_name>/Features/
Dataset/<model_name>/RefLD/

#model training output
Models/<model_name>/SMN.npy
Models/<model_name>/FSN.npy
Models/<model_name>/rf.pkl - the model
```

You can list all existing models with `bin/run model list` and delete a model with
`bin/run model delete <model_name>`.

## WebDAV-based model package repository

You can store model and training data on a WebDAV server, which is particularly
useful for sharing data and collaborative training. To enable this, rename `/.env.dist`
to `.env` and configure the required environment variables.

The available CLI commands can be listed with `bin/run package --help`. To
upload training or model data to the WebDAV server, you can use the `package
publish` command, which has the following syntax

```text
bin/run package publish --help
usage: package publish [-h] [--model-name MODEL_NAME] [--trained-model]
                    [--training-data {extraction,segmentation,all}]
                    [--overwrite]
                    package_name

positional arguments:
  package_name          Name of the package in which to publish the model data

optional arguments:
  -h, --help            show this help message and exit
  --model-name MODEL_NAME, -n MODEL_NAME
                        Name of the model from which to publish data. If not
                        given, the name of the package is used.
  --trained-model, -m   Include the trained model itself
  --training-data {extraction,segmentation,all}, -t {extraction,segmentation,all}
                        The type of training data to include in the package
  --overwrite, -o       Overwrite an existing package
```

The `package_name` is an arbitrary string which should express the content of
the package, plus ideally a timestamp, such as `foo-segm-train-data-20220502` or
`foo-model-data-20220502_075523`. You can choose to upload training data with
the `--training-data` option, which takes either "extraction", "segmentation",
or "all" for both. To share the trained model itself, use `--trained-model`. Since
the model files are large, this will add significantly to the size of the package
and to the time it takes to upload and download the model data. On the other hand,
this saves the time for training the model with the training data first. 

You can then later `bin/run package import <package_name>` to import the package
contents into a model with the same name, which is created if it does not exist. If
you want to import the package contents into a differnt model, specify its name with 
the `--model-name` option. 

Display the list of remotely stored packages with `bin/run package list` and delete a
package with `bin/run package delete <package_name>`.

## Evaluating the performance of a model

To measure the accuracy of a model, we support the following split - train -
eval workflow via scripts that use the CLI commands.

1) `bin/split foo foo_split`: The training data of a model "foo" is split into
80% training data and 20% evaluation data and moved into a newly created model
"foo_split":

2) `bin/train foo_split`: The model is trained with its training data 

3) `bin/eval foo_split`: Extraction and segmentation is run on the
evaluation data and the result is evaluated against the known gold standard.

4) `bin/run report foo_split` prints the accuracy data to the console
(it can also output it to a csv file)

This workflow can be further automated with the `bin/split_train_eval
<model_name>` script, which runs these commands in sequence. 

In order to compare the performance of two models, you can use the `bin/compare
<model1> <model2>` command, which will automatically make a split copies of the
models and add a third model which combines the training data of both models.

## Use different versions of the EXparser engine

In order to be able to compare the performance of different versions of the main
EXparser extraction and segmentation engine, the engine can be dynamically
switched (since v0.2.0). You can install an engine version with `bin/run engine
install <version>` and use it with `bin/run engine use <version>`. A list of
installed engines is available with `bin/run engine list`. Any commit tag on
github can be used as a version (including branches and PRs) or the released
versions listed at https://github.com/cboulanger/excite-docker/releases (except
version 0.1.0, which is not compatible).

## Zotero support 

> Zotero integration is currently not supported because the plugin providing the
required API is not compatible with Zotero 6. A native API is planned by the
Zotero Devs.

If a [Zotero](https://zotero.org) with the appropriate add-ins  is running, the
webapp will enable additional commands that let you retrieve the PDF
attachment(s) of the currently selected item/collection, extract references from
them and store them with the citing item.

If the Zotero storage folder is not located in `~/Zotero/storage`, you need to
rename `.env.dist` to `.env` and in this file, set the `ZOTERO_STORAGE_PATH`
environment variable to the path pointing to this directory.
