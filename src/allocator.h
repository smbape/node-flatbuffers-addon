/**
 * https://github.com/nodejs/nan/blob/master/test/cpp/value.cpp
 */

#ifndef ADDON_ALLOCATOR_H_
#define ADDON_ALLOCATOR_H_

#include <nan.h>

#include "flatbuffers/flatbuffers.h"

using namespace Nan;

namespace NODE_GYP_MODULE_NAME {

#define FREE_BUFFER(buffer) \
    buffer->Reset(); \
    buffer = nullptr

struct AllocatorCursor {
    Persistent<v8::Object> *reference;
    Persistent<v8::Object> *value;
    uint8_t *ptr;
    AllocatorCursor *prev;
    AllocatorCursor *next;
};

// BufferAllocator uses new/delete to allocate memory regions
class BufferAllocator : public flatbuffers::Allocator {
public:
    explicit BufferAllocator() : cursor_(nullptr) {}

    virtual uint8_t *allocate(size_t size) FLATBUFFERS_OVERRIDE {
        // return new uint8_t[size];
        AllocatorCursor *parent = nullptr;
        AllocatorCursor *cursor = cursor_;

        while (cursor) {
            parent = cursor;
            cursor = cursor->next;
        }

        cursor = create_cursor();
        if (!cursor) {
            return nullptr;
        }

        if (parent) {
            parent->next = cursor;
            cursor->prev = parent;
        } else {
            cursor_ = cursor;
        }

        const v8::Local<v8::Object> buffer = NewBuffer(size * sizeof(uint8_t)).ToLocalChecked();
        uint8_t *ptr = reinterpret_cast<uint8_t *>(node::Buffer::Data(buffer));

        if (!ptr) {
            return ptr;
        }

        cursor->value = new Persistent<v8::Object>(buffer);
        cursor->ptr = ptr;

        return ptr;
    }

    virtual void deallocate(uint8_t *p, size_t) FLATBUFFERS_OVERRIDE {
        // delete [] p;
        AllocatorCursor *prev;
        AllocatorCursor *next;
        AllocatorCursor *cursor = cursor_;

        while (cursor) {
            if (cursor->ptr == p) {
                prev = cursor->prev;
                next = cursor->next;

                cursor->ptr = nullptr;
                cursor->prev = nullptr;
                cursor->next = nullptr;
                FREE_BUFFER(cursor->value);
                FREE_BUFFER(cursor->reference);

                if (prev) {
                    prev->next = next;
                    if (next) {
                        next->prev = prev;
                    }
                } else {
                    cursor_ = next;
                }

                break;
            }
            cursor = cursor->next;
        }
    }

    static BufferAllocator &instance() {
        static BufferAllocator inst;
        return inst;
    }
private:
    AllocatorCursor *cursor_;

    AllocatorCursor *create_cursor() {
        v8::Local<v8::Object> *buffer;
        
        buffer = &NewBuffer(sizeof(AllocatorCursor)).ToLocalChecked();
        Persistent<v8::Object> *reference = new Persistent<v8::Object>(*buffer);
        AllocatorCursor *cursor = reinterpret_cast<AllocatorCursor *>(node::Buffer::Data(*buffer));

        if (!cursor) {
            return nullptr;
        }

        cursor->reference = reference;
        cursor->value = nullptr;
        cursor->prev = nullptr;
        cursor->next = nullptr;
        return cursor;
    }
};


// DefaultAllocator uses new/delete to allocate memory regions
class DefaultAllocator : public flatbuffers::Allocator {
public:
    virtual uint8_t *allocate(size_t size) FLATBUFFERS_OVERRIDE {
        return new uint8_t[size];
    }

    virtual void deallocate(uint8_t *p, size_t) FLATBUFFERS_OVERRIDE {
        delete[] p;
    }

    static DefaultAllocator & instance() {
        static DefaultAllocator inst;
        return inst;
    }
};

}
#endif  // ADDON_ALLOCATOR_H_
