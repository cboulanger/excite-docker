import csv
import os
import pickle
import sklearn_crfsuite
from .src.word_lists import *
from .src.gle_fun_seg import *
from lib.logger import log
from lib.pogressbar import get_progress_bar
from configs import *

def train_segmentation(dataset_dir: str, model_dir: str):

    # preparing training data
    train_sents = []
    train_feat = []
    train_label = []
    seg_dir = os.path.join(dataset_dir, DatasetDirs.SEG.value)
    seg_files = os.listdir(seg_dir)
    total = len(seg_files)
    counter = 0
    progress_bar = get_progress_bar("Segmentation training", total)
    log("Segmentation training")
    for u in range(total):
        counter += 1
        progress_bar.goto(counter)
        curr_file = seg_files[u]
        if curr_file.startswith(".") or not curr_file.endswith(".xml"):
            continue
        log(f" - {curr_file}")
        fname = os.path.join(seg_dir, curr_file)
        file = open(fname, encoding="utf-8")
        reader = csv.reader(file, delimiter='\t', quoting=csv.QUOTE_NONE)  # , quotechar='|'
        linenum = 0
        for row in reader:
            try:
                ln = row[0]
                ln = re.sub(r'<author>|</author>', '', ln)  # remove author tag
                ln = re.sub(r'</fpage>|<lpage>', '', ln)  # change page tag
                ln = re.sub(r'<fpage>', '<page>', ln)  # change page tag
                ln = re.sub(r'</lpage>', '</page>', ln)  # change page tag
                ln = preproc(ln)
                ln = ln.split()
                l = -1  # no tag is open
                w = ln[0]
                a, b, l = findtag(w, l)

                train_sents.append([(a, b)])
                train_feat.append([word2feat(a, 0, len(ln))])
                train_label.append([b])

                if 1 < len(ln):
                    w1 = ln[1]
                    a, b, l = findtag(w1, l)
                    train_sents[len(train_sents) - 1].extend([(a, b)])
                    train_feat[len(train_feat) - 1].extend([word2feat(a, 1, len(ln))])
                    train_label[len(train_label) - 1].extend([b])

                if 2 < len(ln):
                    w2 = ln[2]
                    a, b, l = findtag(w2, l)
                    train_sents[len(train_sents) - 1].extend([(a, b)])
                    train_feat[len(train_feat) - 1].extend([word2feat(a, 2, len(ln))])
                    train_label[len(train_label) - 1].extend([b])
                # update features
                train_feat[len(train_feat) - 1] = add2feat(train_feat[len(train_feat) - 1], 0)

                for i in range(1, len(ln)):
                    # add the +2 word
                    if i < len(ln) - 2:
                        w = ln[i + 2]
                        a, b, l = findtag(w, l)
                        train_sents[len(train_sents) - 1].extend([(a, b)])
                        train_feat[len(train_feat) - 1].extend(
                            [word2feat(a, i + 2, len(ln))])
                        train_label[len(train_label) - 1].extend([b])
                    # add their features to w
                    # update features
                    train_feat[len(train_feat) - 1] = add2feat(train_feat[len(train_feat) - 1], i)
            except IndexError as err:
                print(curr_file + ", line " + str(linenum) + ": problem parsing " + row[0])
                continue
            finally:
                linenum += 1
        file.close()
    progress_bar.finish()
    print("Learning...")
    crf = sklearn_crfsuite.CRF(
        algorithm='pa',
        # c2=0.8,
        all_possible_transitions=True,
        all_possible_states=True
    )
    crf.fit(train_feat, train_label)
    with open(os.path.join(model_dir, 'crf_model.pkl'), 'wb') as file:
        pickle.dump(crf, file)
